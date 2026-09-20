import io
import re
import unicodedata
import gc
import pandas as pd
import numpy as np
from openpyxl import load_workbook

def remove_accents(text: str) -> str:
    """Remove Vietnamese accents and normalize string to lowercase snake_case for comparison."""
    if not isinstance(text, str):
        text = str(text)
    text = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('utf-8')
    text = text.lower().strip()
    text = re.sub(r'[^a-z0-9]+', '_', text).strip('_')
    return text

COLUMN_MAPPING = {
    'plan_issue_date': ['plan_issue_date', 'plan issue date', 'ngay_len_ke_hoach', 'ngay_ke_hoach', 'plan_date', 'issue_date'],
    'carrier_code': ['carrier_code', 'service_agent', 'service agent', 'ma_nvc', 'ma_nha_van_chuyen'],
    'carrier_name': ['carrier_name', 'short_name', 'short name', 'ten_nvc', 'ten_nha_van_chuyen', 'nvc', 'carrier'],
    'shipment_number': ['shipment_number', 'shipment number', 'so_lo', 'so_lo_hang', 'shipment', 'lo_hang'],
    'is_return': ['is_return', 'is return', 'hang_tra', 'hang_tra_ve', 'return'],
    'ship_to_code': ['ship_to_code', 'ship_to', 'ship to', 'ma_diem_giao'],
    'ship_to_name': ['ship_to_name', 'ship to name', 'ten_diem_giao'],
    'province': ['province', 'province_name', 'province name', 'tinh_thanh', 'tinh', 'khu_vuc'],
    'route_code': ['route_code', 'route code', 'ma_tuyen', 'tuyen'],
    'delivery_type': ['delivery_type', 'delivery type', 'loai_hinh_giao', 'loai_giao_hang'],
    'tons': ['tons', 'tons_calc', 'tons calc', 'so_tan', 'trong_luong_tan'],
    'freight_fee_1': ['freight_fee_1', 'zf01', 'cuoc_chinh_1'],
    'freight_fee_2': ['freight_fee_2', 'zf02', 'cuoc_chinh_2'],
    'surcharge_1': ['surcharge_1', 'zsc1', 'phu_phi_1'],
    'surcharge_3': ['surcharge_3', 'zsc3', 'phu_phi_3'],
    'surcharge_4': ['surcharge_4', 'zsc4', 'phu_phi_4'],
    'tax_or_fee_1': ['tax_or_fee_1', 'zt01', 'thue_phi_1'],
    'tax_or_fee_3': ['tax_or_fee_3', 'zt03', 'thue_phi_3'],
    'tax_or_fee_4': ['tax_or_fee_4', 'zt04', 'thue_phi_4'],
    'total_amount': ['total_amount', 'total_amt', 'total amt', 'tong_tien', 'tong_cuoc', 'total_cost']
}

REVERSE_MAPPING = {}
for canonical, aliases in COLUMN_MAPPING.items():
    for alias in aliases:
        REVERSE_MAPPING[remove_accents(alias)] = canonical


class TransportDataProcessor:
    def __init__(self, raw_df: pd.DataFrame = None):
        self._filter_cache = {}
        if raw_df is not None:
            self.df = self._preprocess(raw_df)
        else:
            self.df = pd.DataFrame()

    @staticmethod
    def _get_engine(file_bytes: bytes) -> str:
        """Return 'calamine' if available for ultra-fast reading, else None for default."""
        try:
            import python_calamine
            return 'calamine'
        except ImportError:
            return None

    @classmethod
    def detect_header_row(cls, file_bytes: bytes, sheet_name=0) -> int:
        """Scan first 10 rows of an Excel file to detect header row index."""
        try:
            engine = cls._get_engine(file_bytes)
            kwargs = {'engine': engine} if engine else {}
            preview_df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=sheet_name, header=None, nrows=10, **kwargs)
            non_null_counts = preview_df.notna().sum(axis=1)
            best_header_idx = int(non_null_counts.idxmax())
            return best_header_idx
        except Exception:
            return 0

    @classmethod
    def get_sheet_names(cls, file_bytes: bytes) -> list:
        """Return list of sheet names in the Excel file ultra-fast."""
        engine = cls._get_engine(file_bytes)
        kwargs = {'engine': engine} if engine else {}
        excel_file = pd.ExcelFile(io.BytesIO(file_bytes), **kwargs)
        return excel_file.sheet_names

    @classmethod
    def load_excel(cls, file_bytes: bytes, sheet_name=0, chunk_size=1000) -> 'TransportDataProcessor':
        """Load Excel file with streaming reading using openpyxl read_only=True for memory efficiency."""
        header_row = cls.detect_header_row(file_bytes, sheet_name=sheet_name)

        # If chunk_size is None, use pandas full read for small files
        if chunk_size is None:
            print("📖 Using pandas full read (no chunking)")
            engine = cls._get_engine(file_bytes)
            kwargs = {'engine': engine} if engine else {}
            raw_df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=sheet_name, header=header_row, **kwargs)
            return cls(raw_df)

        # Use openpyxl read_only=True for streaming (memory-efficient)
        try:
            print(f"🔄 Using openpyxl streaming read (single DataFrame creation)")

            # Save bytes to temp file for openpyxl
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
                tmp_file.write(file_bytes)
                tmp_file_path = tmp_file.name

            try:
                # Load workbook in read-only mode (streaming)
                wb = load_workbook(tmp_file_path, read_only=True, data_only=True)

                # Get the sheet
                if isinstance(sheet_name, int):
                    ws = wb.worksheets[sheet_name]
                else:
                    ws = wb[sheet_name]

                # Read header row
                header_row_idx = header_row + 1  # openpyxl is 1-indexed
                headers = None
                current_rows = []

                print(f"📋 Reading data starting from row {header_row_idx + 1}...")

                for i, row in enumerate(ws.iter_rows(min_row=header_row_idx + 1, values_only=True)):
                    if i == 0:
                        # First row after header is our data header
                        headers = [str(cell) if cell is not None else f"col_{j}" for j, cell in enumerate(row)]
                        print(f"📋 Headers detected: {headers[:5]}...")
                        continue

                    current_rows.append(row)

                    # Memory cleanup periodically
                    if len(current_rows) % 10000 == 0:
                        gc.collect()

                wb.close()

                if not current_rows:
                    print("⚠️ No data found in streaming read, falling back to pandas")
                    raise ValueError("No data found in streaming read")

                print(f"✅ Collected {len(current_rows)} rows, creating single DataFrame...")
                raw_df = pd.DataFrame(current_rows, columns=headers)
                del current_rows
                gc.collect()
                print(f"✅ Created DataFrame with {len(raw_df)} rows")

                return cls(raw_df)

            finally:
                # Clean up temp file
                import os
                if os.path.exists(tmp_file_path):
                    os.unlink(tmp_file_path)

        except Exception as e:
            print(f"⚠️ Streaming read failed: {e}, falling back to pandas")
            gc.collect()

            # Fallback to pandas full read
            engine = cls._get_engine(file_bytes)
            kwargs = {'engine': engine} if engine else {}
            raw_df = pd.read_excel(io.BytesIO(file_bytes), sheet_name=sheet_name, header=header_row, **kwargs)
            return cls(raw_df)

    def _convert_date_column(self, series: pd.Series) -> pd.Series:
        """Fast vectorized conversion of mixed serial numbers / text / datetime series."""
        if series.empty:
            return series

        # Fast path if already datetime
        if pd.api.types.is_datetime64_any_dtype(series):
            return series

        # Convert to string and clean
        s_clean = series.astype(str).str.strip()

        # Handle numeric serial numbers (e.g. 45200.5)
        is_numeric = s_clean.str.match(r'^\d+(\.\d+)?$')
        result = pd.Series(pd.NaT, index=series.index)

        if is_numeric.any():
            numeric_vals = pd.to_numeric(s_clean[is_numeric], errors='coerce')
            result[is_numeric] = pd.to_datetime(numeric_vals, unit='D', origin='1899-12-30', errors='coerce')

        # Handle standard string dates
        non_numeric = ~is_numeric & (s_clean != 'nan') & (s_clean != '') & (s_clean != 'None')
        if non_numeric.any():
            result[non_numeric] = pd.to_datetime(s_clean[non_numeric], errors='coerce', dayfirst=True)

        return result

    def _preprocess(self, raw_df: pd.DataFrame) -> pd.DataFrame:
        """Standardize column names, data types, clean text, and parse dates."""
        df = raw_df  # Remove .copy() to save memory

        # Remove unnecessary columns to reduce memory and file size
        # Based on actual file structure from datavc.xlsx
        columns_to_remove = [
            'plant', 'id', 'sale org', 'mcat', 'invoice id', 'lock status',
            'settlement date', 'ship to', 'ship to address', 'trans local',
            'od', 'so', 'chassic code', 'material', 'material name', 'base unit', 'qty',
            'channel'  # Thêm channel vì không cần thiết cho dashboard
        ]

        # Match columns using fuzzy matching (remove accents)
        columns_to_remove_normalized = [remove_accents(col) for col in columns_to_remove]
        columns_to_remove_normalized_set = set(columns_to_remove_normalized)

        cols_to_drop = []
        for col in df.columns:
            if remove_accents(str(col)) in columns_to_remove_normalized_set:
                cols_to_drop.append(col)

        if cols_to_drop:
            print(f"🗑️ Removing {len(cols_to_drop)} unnecessary columns: {cols_to_drop}")
            print(f"📊 Before removal: {len(df.columns)} columns, {df.memory_usage(deep=True).sum() / 1024:.1f} KB memory")
            df.drop(columns=cols_to_drop, inplace=True)
            gc.collect()  # Force garbage collection after column removal
            print(f"📊 After removal: {len(df.columns)} columns, {df.memory_usage(deep=True).sum() / 1024:.1f} KB memory")
        else:
            print(f"ℹ️ No unnecessary columns found to remove")

        # Map column names
        column_rename = {}
        for col in df.columns:
            cleaned_col = remove_accents(str(col))
            if cleaned_col in REVERSE_MAPPING:
                column_rename[col] = REVERSE_MAPPING[cleaned_col]

        df.rename(columns=column_rename, inplace=True)

        # Ensure all canonical columns exist
        for col in COLUMN_MAPPING.keys():
            if col not in df.columns:
                if col in ['tons', 'freight_fee_1', 'freight_fee_2', 'surcharge_1', 'surcharge_3', 'surcharge_4', 'tax_or_fee_1', 'tax_or_fee_3', 'tax_or_fee_4', 'total_amount']:
                    df[col] = 0.0
                elif col == 'is_return':
                    df[col] = False
                else:
                    df[col] = ''

        # Force garbage collection after preprocessing
        gc.collect()
        print(f"✅ Preprocessing complete: {len(df.columns)} columns, {len(df)} rows")

        # Parse dates
        df['plan_issue_date'] = self._convert_date_column(df['plan_issue_date'])
        df['settlement_date'] = self._convert_date_column(df['settlement_date'])

        # Derive Year, Month, Year-Month
        df['year'] = df['plan_issue_date'].dt.year.fillna(0).astype(int)
        df['month'] = df['plan_issue_date'].dt.month.fillna(0).astype(int)
        df['year_month'] = df['plan_issue_date'].dt.strftime('%Y-%m').fillna('UNKNOWN')

        # Clean string columns
        string_cols = ['carrier_code', 'carrier_name', 'plant', 'shipment_number', 'ship_to_code', 'ship_to_name', 'ship_to_address', 'province', 'route_code', 'delivery_type', 'material_code', 'material_name', 'base_unit']
        for col in string_cols:
            df[col] = df[col].astype(str).str.strip().str.upper()
            df[col] = df[col].replace(['NAN', 'NONE', 'NULL', 'UNKNOWN', ''], 'UNKNOWN')

        # Clean boolean is_return
        def parse_bool(x):
            if pd.isna(x): return False
            val = str(x).strip().lower()
            return val in ['true', '1', 'yes', 'y', 'x', 't']

        df['is_return'] = df['is_return'].apply(parse_bool)

        # Clean numeric columns
        numeric_cols = ['qty', 'tons', 'freight_fee_1', 'freight_fee_2', 'surcharge_1', 'surcharge_3', 'surcharge_4', 'tax_or_fee_1', 'tax_or_fee_3', 'tax_or_fee_4', 'total_amount']
        for col in numeric_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)

        # Drop rows where critical metadata is missing completely if any
        return df

    def _get_filter_key(self, filters: dict) -> str:
        """Create hashable key for filter dictionary."""
        if not filters:
            return "ALL"
        items = []
        for k in sorted(filters.keys()):
            v = filters[k]
            if isinstance(v, list):
                v_str = ",".join(sorted(str(x) for x in v))
            else:
                v_str = str(v)
            items.append(f"{k}:{v_str}")
        return "|".join(items)

    def _apply_filters(self, filters: dict = None) -> pd.DataFrame:
        """Filter DataFrame based on user criteria with internal memory cache."""
        if not filters:
            filters = {}

        filter_key = self._get_filter_key(filters)
        if filter_key in self._filter_cache:
            return self._filter_cache[filter_key]

        filtered_df = self.df.copy()

        # Handle return toggle (exclude returns by default if exclude_return is True)
        exclude_return = filters.get('exclude_return', True)
        if isinstance(exclude_return, str):
            exclude_return = exclude_return.lower() in ['true', '1', 'yes']
        if exclude_return:
            filtered_df = filtered_df[~filtered_df['is_return']]

        # Carrier filter
        carriers = filters.get('carrier') or filters.get('carrier[]')
        if carriers:
            if isinstance(carriers, str): carriers = [carriers]
            carriers = [str(c).strip().upper() for c in carriers if c]
            if carriers:
                filtered_df = filtered_df[filtered_df['carrier_name'].isin(carriers)]

        # Province filter
        provinces = filters.get('province') or filters.get('province[]')
        if provinces:
            if isinstance(provinces, str): provinces = [provinces]
            provinces = [str(p).strip().upper() for p in provinces if p]
            if provinces:
                filtered_df = filtered_df[filtered_df['province'].isin(provinces)]

        # Delivery type filter
        delivery_types = filters.get('delivery_type') or filters.get('delivery_type[]')
        if delivery_types:
            if isinstance(delivery_types, str): delivery_types = [delivery_types]
            delivery_types = [str(d).strip().upper() for d in delivery_types if d]
            if delivery_types:
                filtered_df = filtered_df[filtered_df['delivery_type'].isin(delivery_types)]

        # Route code filter
        route_codes = filters.get('route_code') or filters.get('route_code[]')
        if route_codes:
            if isinstance(route_codes, str): route_codes = [route_codes]
            route_codes = [str(r).strip().upper() for r in route_codes if r]
            if route_codes:
                filtered_df = filtered_df[filtered_df['route_code'].isin(route_codes)]

        # Years filter
        years = filters.get('years') or filters.get('years[]') or filters.get('year')
        if years:
            if isinstance(years, (str, int)): years = [years]
            years = [int(y) for y in years if str(y).isdigit()]
            if years:
                filtered_df = filtered_df[filtered_df['year'].isin(years)]

        # Months filter
        months = filters.get('months') or filters.get('months[]') or filters.get('month')
        if months:
            if isinstance(months, (str, int)): months = [months]
            months = [int(m) for m in months if str(m).isdigit()]
            if months:
                filtered_df = filtered_df[filtered_df['month'].isin(months)]

        # Date range filter
        start_date = filters.get('start_date')
        end_date = filters.get('end_date')
        if start_date:
            try:
                s_dt = pd.to_datetime(start_date)
                filtered_df = filtered_df[filtered_df['plan_issue_date'] >= s_dt]
            except Exception:
                pass
        if end_date:
            try:
                e_dt = pd.to_datetime(end_date)
                filtered_df = filtered_df[filtered_df['plan_issue_date'] <= e_dt]
            except Exception:
                pass

        # Limit cache size to prevent memory leak
        if len(self._filter_cache) > 20:
            self._filter_cache.pop(next(iter(self._filter_cache)))

        self._filter_cache[filter_key] = filtered_df
        return filtered_df

    def get_kpis(self, filters: dict = None) -> dict:
        """Calculate 7 KPI metrics for dashboard top cards."""
        df = self._apply_filters(filters)
        total_rows = len(df)
        if total_rows == 0:
            return {
                'total_tons': 0.0,
                'total_cost': 0.0,
                'carrier_count': 0,
                'shipment_count': 0,
                'province_count': 0,
                'avg_unit_price': 0.0,
                'return_rate': 0.0,
                'total_records': 0
            }

        total_tons = float(df['tons'].sum())
        total_cost = float(df['total_amount'].sum())
        carrier_count = int(df[df['carrier_name'] != 'UNKNOWN']['carrier_name'].nunique())
        
        valid_shipments = df[df['shipment_number'] != 'UNKNOWN']['shipment_number']
        shipment_count = int(valid_shipments.nunique())
        
        province_count = int(df[df['province'] != 'UNKNOWN']['province'].nunique())
        avg_unit_price = float(total_cost / total_tons) if total_tons > 0 else 0.0

        # Calculate return rate against total raw records (including returns)
        raw_filtered = self._apply_filters({**(filters or {}), 'exclude_return': False})
        return_count = int(raw_filtered['is_return'].sum())
        total_raw_count = len(raw_filtered)
        return_rate = float((return_count / total_raw_count) * 100) if total_raw_count > 0 else 0.0

        return {
            'total_tons': round(total_tons, 2),
            'total_cost': round(total_cost, 0),
            'carrier_count': carrier_count,
            'shipment_count': shipment_count,
            'province_count': province_count,
            'avg_unit_price': round(avg_unit_price, 0),
            'return_rate': round(return_rate, 2),
            'total_records': total_rows
        }

    def get_charts_data(self, filters: dict = None) -> dict:
        """Generate series data for dashboard charts."""
        df = self._apply_filters(filters)

        # 1. Monthly Trend
        monthly_trend = []
        if not df.empty and 'year_month' in df.columns:
            valid_df = df[df['year_month'] != 'UNKNOWN']
            if not valid_df.empty:
                grouped = valid_df.groupby('year_month').agg(
                    tons=('tons', 'sum'),
                    cost=('total_amount', 'sum'),
                    shipments=('shipment_number', lambda x: x[x != 'UNKNOWN'].nunique())
                ).reset_index().sort_values('year_month')

                for _, row in grouped.iterrows():
                    monthly_trend.append({
                        'month': row['year_month'],
                        'tons': round(float(row['tons']), 2),
                        'cost': round(float(row['cost']), 0),
                        'shipments': int(row['shipments'])
                    })

        # 2. Carrier Ranking
        carrier_ranking = []
        if not df.empty:
            grouped = df.groupby('carrier_name').agg(
                tons=('tons', 'sum'),
                cost=('total_amount', 'sum'),
                shipments=('shipment_number', lambda x: x[x != 'UNKNOWN'].nunique())
            ).reset_index().sort_values('tons', ascending=False)

            for _, row in grouped.iterrows():
                carrier = str(row['carrier_name'])
                if carrier == 'UNKNOWN': continue
                t = float(row['tons'])
                c = float(row['cost'])
                s = int(row['shipments'])
                unit_price = (c / t) if t > 0 else 0.0

                carrier_ranking.append({
                    'carrier_name': carrier,
                    'tons': round(t, 2),
                    'cost': round(c, 0),
                    'shipments': s,
                    'avg_unit_price': round(unit_price, 0)
                })

        # 3. Province Distribution
        province_dist = []
        if not df.empty:
            grouped = df.groupby('province').agg(
                tons=('tons', 'sum'),
                cost=('total_amount', 'sum'),
                carriers=('carrier_name', lambda x: x[x != 'UNKNOWN'].nunique())
            ).reset_index().sort_values('tons', ascending=False)

            for _, row in grouped.iterrows():
                prov = str(row['province'])
                if prov == 'UNKNOWN': continue
                province_dist.append({
                    'province': prov,
                    'tons': round(float(row['tons']), 2),
                    'cost': round(float(row['cost']), 0),
                    'carriers': int(row['carriers'])
                })

        # 4. Carrier x Province Pivot Matrix
        matrix_data = {
            'carriers': [],
            'provinces': [],
            'matrix': []
        }
        if not df.empty:
            valid_matrix_df = df[(df['carrier_name'] != 'UNKNOWN') & (df['province'] != 'UNKNOWN')]
            if not valid_matrix_df.empty:
                pivot = valid_matrix_df.pivot_table(index='carrier_name', columns='province', values='tons', aggfunc='sum', fill_value=0.0)
                carriers_list = list(pivot.index)
                provinces_list = list(pivot.columns)
                matrix_rows = []

                for carrier in carriers_list:
                    row_dict = {'carrier_name': carrier}
                    for prov in provinces_list:
                        row_dict[prov] = round(float(pivot.loc[carrier, prov]), 2)
                    matrix_rows.append(row_dict)

                matrix_data = {
                    'carriers': carriers_list,
                    'provinces': provinces_list,
                    'matrix': matrix_rows
                }

        # 5. Cost Breakdown Structure
        cost_breakdown = []
        if not df.empty:
            f1 = float(df['freight_fee_1'].sum())
            f2 = float(df['freight_fee_2'].sum())
            s1 = float(df['surcharge_1'].sum())
            s3 = float(df['surcharge_3'].sum())
            s4 = float(df['surcharge_4'].sum())
            t1 = float(df['tax_or_fee_1'].sum())
            t3 = float(df['tax_or_fee_3'].sum())
            t4 = float(df['tax_or_fee_4'].sum())

            cost_breakdown = [
                {'name': 'Cước chính (ZF01)', 'amount': round(f1, 0)},
                {'name': 'Cước phụ (ZF02)', 'amount': round(f2, 0)},
                {'name': 'Phụ phí 1 (ZSC1)', 'amount': round(s1, 0)},
                {'name': 'Phụ phí 3 (ZSC3)', 'amount': round(s3, 0)},
                {'name': 'Phụ phí 4 (ZSC4)', 'amount': round(s4, 0)},
                {'name': 'Thuế/phí 1 (ZT01)', 'amount': round(t1, 0)},
                {'name': 'Thuế/phí 3 (ZT03)', 'amount': round(t3, 0)},
                {'name': 'Thuế/phí 4 (ZT04)', 'amount': round(t4, 0)},
            ]
            cost_breakdown = [item for item in cost_breakdown if item['amount'] > 0]

        # 6. Top 5 Carrier Trend
        carrier_trend = []
        if not df.empty and carrier_ranking:
            top5_carriers = [c['carrier_name'] for c in carrier_ranking[:5]]
            valid_trend_df = df[df['carrier_name'].isin(top5_carriers) & (df['year_month'] != 'UNKNOWN')]

            if not valid_trend_df.empty:
                pivot_trend = valid_trend_df.pivot_table(index='year_month', columns='carrier_name', values='tons', aggfunc='sum', fill_value=0.0).sort_index()

                for ym, row in pivot_trend.iterrows():
                    item = {'month': ym}
                    for carrier in top5_carriers:
                        item[carrier] = round(float(row.get(carrier, 0.0)), 2)
                    carrier_trend.append(item)

        # 7. Vietnam Map Regional & Top Carrier Route Breakdown
        vietnam_map_data = {
            'top_carriers': [],
            'provinces': []
        }
        if not df.empty:
            valid_map_df = df[(df['carrier_name'] != 'UNKNOWN') & (df['province'] != 'UNKNOWN')]
            if not valid_map_df.empty:
                # All carriers sorted by total tonnage descending
                top_carrier_names = valid_map_df.groupby('carrier_name')['tons'].sum().sort_values(ascending=False).index.tolist()
                vietnam_map_data['top_carriers'] = top_carrier_names

                prov_grouped = valid_map_df.groupby(['province', 'carrier_name']).agg(
                    tons=('tons', 'sum'),
                    cost=('total_amount', 'sum')
                ).reset_index()

                prov_summary = valid_map_df.groupby('province').agg(
                    total_tons=('tons', 'sum'),
                    total_cost=('total_amount', 'sum'),
                    carrier_count=('carrier_name', 'nunique')
                ).reset_index()

                province_map_list = []
                for _, p_row in prov_summary.iterrows():
                    prov_name = str(p_row['province'])
                    p_details = prov_grouped[prov_grouped['province'] == prov_name]
                    
                    carrier_breakdown = {}
                    for _, c_row in p_details.iterrows():
                        c_name = str(c_row['carrier_name'])
                        carrier_breakdown[c_name] = carrier_breakdown.get(c_name, 0.0) + round(float(c_row['tons']), 2)

                    province_map_list.append({
                        'province': prov_name,
                        'total_tons': round(float(p_row['total_tons']), 2),
                        'total_cost': round(float(p_row['total_cost']), 0),
                        'carrier_count': int(p_row['carrier_count']),
                        'carriers': carrier_breakdown
                    })

                vietnam_map_data['provinces'] = province_map_list

        return {
            'monthlyTrend': monthly_trend,
            'carrierRanking': carrier_ranking,
            'provinceDistribution': province_dist,
            'carrierProvinceMatrix': matrix_data,
            'costBreakdown': cost_breakdown,
            'carrierTrend': carrier_trend,
            'vietnamMap': vietnam_map_data
        }

    def get_filter_options(self, current_filters: dict = None) -> dict:
        """Cascading filter options calculation."""
        df = self._apply_filters(current_filters)
        if df.empty:
            return {
                'years': [],
                'months': [],
                'carriers': [],
                'provinces': [],
                'delivery_types': [],
                'route_codes': []
            }

        years = sorted([int(y) for y in df['year'].unique() if y > 0], reverse=True)
        months = sorted([int(m) for m in df['month'].unique() if m > 0])
        carriers = sorted([str(c) for c in df['carrier_name'].unique() if c != 'UNKNOWN'])
        provinces = sorted([str(p) for p in df['province'].unique() if p != 'UNKNOWN'])
        delivery_types = sorted([str(d) for d in df['delivery_type'].unique() if d != 'UNKNOWN'])
        route_codes = sorted([str(r) for r in df['route_code'].unique() if r != 'UNKNOWN'])

        return {
            'years': years,
            'months': months,
            'carriers': carriers,
            'provinces': provinces,
            'delivery_types': delivery_types,
            'route_codes': route_codes
        }

    def get_table_data(self, filters: dict = None, page: int = 1, page_size: int = 20, sort_by: str = None, sort_order: str = 'asc', search: str = None) -> dict:
        """Paginated, searchable data table response."""
        df = self._apply_filters(filters)

        if search:
            search_clean = str(search).strip().upper()
            mask = (
                df['carrier_name'].astype(str).str.contains(search_clean, na=False) |
                df['province'].astype(str).str.contains(search_clean, na=False) |
                df['shipment_number'].astype(str).str.contains(search_clean, na=False) |
                df['ship_to_name'].astype(str).str.contains(search_clean, na=False) |
                df['route_code'].astype(str).str.contains(search_clean, na=False) |
                df['material_name'].astype(str).str.contains(search_clean, na=False)
            )
            df = df[mask]

        total_records = len(df)

        if sort_by and sort_by in df.columns:
            ascending = (sort_order.lower() == 'asc')
            df = df.sort_values(by=sort_by, ascending=ascending)

        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paged_df = df.iloc[start_idx:end_idx].copy()

        # Format timestamps to ISO strings
        records = []
        for _, row in paged_df.iterrows():
            item = row.to_dict()
            if pd.notna(item['plan_issue_date']):
                item['plan_issue_date'] = item['plan_issue_date'].strftime('%Y-%m-%d')
            else:
                item['plan_issue_date'] = ''
            if pd.notna(item['settlement_date']):
                item['settlement_date'] = item['settlement_date'].strftime('%Y-%m-%d')
            else:
                item['settlement_date'] = ''
            records.append(item)

        total_pages = int(np.ceil(total_records / page_size)) if page_size > 0 else 1

        return {
            'records': records,
            'total': total_records,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages
        }

    def get_carrier_routes(self, carrier_name: str, group_by: str = 'month', filters: dict = None) -> dict:
        """Return route-level tonnage/cost/shipments data for a specific carrier,
        grouped by route_code and optionally by week or month time period."""
        df = self._apply_filters(filters)

        # Filter for specific carrier (case-insensitive)
        carrier_upper = str(carrier_name).strip().upper()
        carrier_df = df[df['carrier_name'] == carrier_upper].copy()

        if carrier_df.empty:
            return {
                'carrier_name': carrier_name,
                'group_by': group_by,
                'routes': [],
                'time_series': [],
                'summary': []
            }

        # Derive time period label cleanly
        if group_by == 'week':
            carrier_df['time_period'] = carrier_df['plan_issue_date'].apply(
                lambda d: f"Tuần {d.isocalendar()[1]:02d}/{d.year}" if pd.notna(d) else 'UNKNOWN'
            )
        else:
            carrier_df['time_period'] = carrier_df['plan_issue_date'].apply(
                lambda d: f"Tháng {d.month:02d}/{d.year}" if pd.notna(d) else 'UNKNOWN'
            )

        valid_df = carrier_df[(carrier_df['route_code'] != 'UNKNOWN') & (carrier_df['time_period'] != 'UNKNOWN')]

        # Helper to get exact single mode province per route
        def get_main_province(s):
            valid = s[s != 'UNKNOWN']
            if valid.empty: return 'UNKNOWN'
            m = valid.mode()
            return str(m.iloc[0]) if not m.empty else str(valid.iloc[0])

        # 1. Route summary (aggregated totals per route_code x time_period)
        route_summary = []
        if not valid_df.empty:
            route_agg = valid_df.groupby(['route_code', 'time_period']).agg(
                tons=('tons', 'sum'),
                cost=('total_amount', 'sum'),
                shipments=('shipment_number', lambda x: x[x != 'UNKNOWN'].nunique()),
                province=('province', get_main_province)
            ).reset_index().sort_values(['time_period', 'tons'], ascending=[True, False])

            for _, row in route_agg.iterrows():
                t = float(row['tons'])
                c = float(row['cost'])
                route_summary.append({
                    'route_code': str(row['route_code']),
                    'time_period': str(row['time_period']),
                    'tons': round(t, 2),
                    'cost': round(c, 0),
                    'shipments': int(row['shipments']),
                    'avg_unit_price': round(c / t, 0) if t > 0 else 0.0,
                    'province': str(row['province'])
                })

        # 2. Time-series per route_code (for line/bar chart view)
        time_series = []
        if not valid_df.empty:
            ts_agg = valid_df.groupby(['route_code', 'time_period']).agg(
                tons=('tons', 'sum'),
                cost=('total_amount', 'sum'),
                shipments=('shipment_number', lambda x: x[x != 'UNKNOWN'].nunique())
            ).reset_index().sort_values(['route_code', 'time_period'])

            for _, row in ts_agg.iterrows():
                time_series.append({
                    'route_code': str(row['route_code']),
                    'time_period': str(row['time_period']),
                    'tons': round(float(row['tons']), 2),
                    'cost': round(float(row['cost']), 0),
                    'shipments': int(row['shipments'])
                })

        # 3. Overall carrier summary stats
        total_tons = float(carrier_df['tons'].sum())
        total_cost = float(carrier_df['total_amount'].sum())
        total_shipments = int(carrier_df[carrier_df['shipment_number'] != 'UNKNOWN']['shipment_number'].nunique())
        route_count = int(carrier_df[carrier_df['route_code'] != 'UNKNOWN']['route_code'].nunique())

        return {
            'carrier_name': carrier_name,
            'group_by': group_by,
            'summary': {
                'total_tons': round(total_tons, 2),
                'total_cost': round(total_cost, 0),
                'total_shipments': total_shipments,
                'route_count': route_count,
                'avg_unit_price': round(total_cost / total_tons, 0) if total_tons > 0 else 0.0
            },
            'routes': route_summary,
            'time_series': time_series
        }

    def export_excel(self, filters: dict = None) -> bytes:
        """Export current filtered dataset into a multi-sheet Excel file."""
        df = self._apply_filters(filters)
        kpis = self.get_kpis(filters)
        charts = self.get_charts_data(filters)

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # Sheet 1: Raw Data
            export_raw = df.copy()
            if 'plan_issue_date' in export_raw.columns:
                export_raw['plan_issue_date'] = export_raw['plan_issue_date'].dt.strftime('%Y-%m-%d')
            if 'settlement_date' in export_raw.columns:
                export_raw['settlement_date'] = export_raw['settlement_date'].dt.strftime('%Y-%m-%d')
            export_raw.to_excel(writer, sheet_name='Dữ liệu vận chuyển', index=False)

            # Sheet 2: KPI Summary
            kpi_df = pd.DataFrame([
                {'Chỉ số (KPI)': 'Tổng sản lượng (Tấn)', 'Giá trị': kpis['total_tons']},
                {'Chỉ số (KPI)': 'Tổng chi phí vận chuyển (VNĐ)', 'Giá trị': kpis['total_cost']},
                {'Chỉ số (KPI)': 'Số nhà vận chuyển', 'Giá trị': kpis['carrier_count']},
                {'Chỉ số (KPI)': 'Số lô hàng (Shipments)', 'Giá trị': kpis['shipment_count']},
                {'Chỉ số (KPI)': 'Số khu vực/tỉnh thành', 'Giá trị': kpis['province_count']},
                {'Chỉ số (KPI)': 'Đơn giá cước bình quân (VNĐ/tấn)', 'Giá trị': kpis['avg_unit_price']},
                {'Chỉ số (KPI)': 'Tỷ lệ hàng trả về (%)', 'Giá trị': kpis['return_rate']}
            ])
            kpi_df.to_excel(writer, sheet_name='KPI Summary', index=False)

            # Sheet 3: Top Carriers
            carriers_df = pd.DataFrame(charts['carrierRanking'])
            carriers_df.rename(columns={
                'carrier_name': 'Nhà vận chuyển',
                'tons': 'Sản lượng (tấn)',
                'cost': 'Tổng chi phí (VNĐ)',
                'shipments': 'Số lô hàng',
                'avg_unit_price': 'Đơn giá TB (VNĐ/tấn)'
            }, inplace=True)
            carriers_df.to_excel(writer, sheet_name='Phân tích NVC', index=False)

            # Sheet 4: Regional Distribution
            prov_df = pd.DataFrame(charts['provinceDistribution'])
            prov_df.rename(columns={
                'province': 'Tỉnh/Thành phố',
                'tons': 'Sản lượng (tấn)',
                'cost': 'Tổng chi phí (VNĐ)',
                'carriers': 'Số NVC phục vụ'
            }, inplace=True)
            prov_df.to_excel(writer, sheet_name='Phân bổ Khu vực', index=False)

            # Sheet 5: Monthly Trend
            trend_df = pd.DataFrame(charts['monthlyTrend'])
            trend_df.rename(columns={
                'month': 'Tháng',
                'tons': 'Sản lượng (tấn)',
                'cost': 'Tổng chi phí (VNĐ)',
                'shipments': 'Số lô hàng'
            }, inplace=True)
            trend_df.to_excel(writer, sheet_name='Xu hướng Tháng', index=False)

        return output.getvalue()
