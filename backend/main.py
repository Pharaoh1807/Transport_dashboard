import uuid
import io
import os
import gc
from typing import List, Optional
from datetime import datetime
from fastapi import FastAPI, File, UploadFile, Query, Depends, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import pandas as pd
import numpy as np

from database import get_database
from auth import get_current_user
from routers import auth as auth_router, admin as admin_router
from processor import TransportDataProcessor

app = FastAPI(title="SAP Transportation Data Analysis API", version="2.0.0")

# CORS middleware
# Allow GitHub Pages and local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://pharaoh1807.github.io", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(admin_router.router)

@app.on_event("startup")
async def startup_db_check():
    from database import is_mongodb, MONGODB_URL, get_db_path
    if is_mongodb():
        print(f"✅ [Database] Đã kết nối thành công tới MongoDB: {MONGODB_URL}")
    else:
        print(f"✅ [Database] Đang sử dụng lưu trữ cục bộ SQLite: {get_db_path()}")
        print("   (Hỗ trợ Đăng nhập & Lưu trữ dữ liệu mượt mà, độc lập)")
    print("🚀 Backend is ready on Render!")
    print("🌐 CORS configured for GitHub Pages and local development")
    print("📁 File upload limit: 50MB (free tier) with streaming chunk processing")
    print("⚡ Streaming chunk processing enabled for files > 5MB")
    print("💾 Memory optimization: openpyxl read_only=True + chunked DB insertion")
    print("🔧 Chunk size: 1,000 rows (streaming for memory efficiency)")
    print("🧹 Memory cache: Global latest file only (not per-user)")

# In-memory RAM cache for DataProcessors indexed by file_id
data_cache = {}
# Limited file bytes cache - only keep most recent file globally to save memory
_file_bytes_cache = {"latest_file_id": None, "contents": None}


async def get_processor(file_id: str, current_user: dict) -> TransportDataProcessor:
    """Retrieve TransportDataProcessor from RAM cache or rebuild from MongoDB."""
    user_id = current_user["_id"]
    is_admin = (current_user.get("role") == "admin")

    if file_id in data_cache:
        proc_info = data_cache[file_id]
        if not is_admin and proc_info.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập file này.")
        return proc_info["processor"]

    # If not in cache, load from DB
    db = get_database()
    file_doc = await db.files.find_one({"_id": file_id})
    if not file_doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy file dữ liệu.")

    if not is_admin and file_doc.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập file này.")

    records_cursor = db.records.find({"file_id": file_id})
    records = await records_cursor.to_list(length=500000)

    if not records:
        raise HTTPException(status_code=404, detail="Dữ liệu file trống hoặc đã bị làm sạch.")

    df = pd.DataFrame(records)
    processor = TransportDataProcessor(df)
    data_cache[file_id] = {
        "processor": processor,
        "user_id": file_doc.get("user_id")
    }
    return processor


@app.get("/")
def read_root():
    return {"message": "SAP Transportation Data API is running", "version": "2.0.0", "status": "healthy"}


@app.get("/health")
def health_check():
    return {"status": "healthy", "version": "2.0.0"}


@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload Excel file with chunk processing for large files."""
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ file Excel (.xlsx, .xls)")

    # Check file size (limit to 50MB for free tier stability)
    file.file.seek(0, 2)  # Seek to end
    file_size = file.file.tell()
    file.file.seek(0)  # Seek back to beginning

    if file_size > 50 * 1024 * 1024:  # 50MB limit for free tier
        raise HTTPException(status_code=413, detail="File quá lớn cho free tier. Vui lòng upload file dưới 50MB hoặc nâng cấp gói dịch vụ.")

    # Warn for large files
    if file_size > 20 * 1024 * 1024:  # > 20MB
        print(f"⚠️ Large file upload detected: {file_size / (1024*1024):.1f}MB - streaming processing enabled")

    # Process in chunks for large files
    if file_size > 5 * 1024 * 1024:  # > 5MB use chunk processing
        chunk_size = 1000  # Process 1,000 rows at a time (streaming with openpyxl)
        print(f"⚡ Streaming chunk processing enabled for {file_size / (1024*1024):.1f}MB file")
    else:
        chunk_size = None  # Process full file for small files

    contents = await file.read()
    file_id = str(uuid.uuid4())
    user_id = current_user["_id"]

    # 1. Auto-cleanup: remove old files & records for this user
    db = get_database()
    old_files = await db.files.find({"user_id": user_id}).to_list(length=100)
    for old_file in old_files:
        old_id = old_file["_id"]
        await db.records.delete_many({"file_id": old_id})
        data_cache.pop(old_id, None)
        # Clear global file bytes cache if this was the latest file
        if _file_bytes_cache["latest_file_id"] == old_id:
            _file_bytes_cache["latest_file_id"] = None
            _file_bytes_cache["contents"] = None
    await db.files.delete_many({"user_id": user_id})

    # 2. Get sheet names & load default sheet 0
    print(f"📋 Reading sheet names from {file_size / (1024*1024):.1f}MB file...")
    sheet_names = TransportDataProcessor.get_sheet_names(contents)
    selected_sheet = sheet_names[0] if sheet_names else 0

    # Load with chunk processing for large files
    print(f"🔄 Loading Excel data with chunk processing (chunk_size={chunk_size})...")
    processor = TransportDataProcessor.load_excel(contents, sheet_name=selected_sheet, chunk_size=chunk_size)
    print(f"✅ Excel data loaded successfully: {len(processor.df)} rows")

    # 3. Store file metadata in MongoDB
    file_meta = {
        "_id": file_id,
        "filename": file.filename,
        "sheet_name": selected_sheet,
        "sheet_names": sheet_names,
        "row_count": len(processor.df),
        "uploaded_at": pd.Timestamp.now().isoformat(),
        "user_id": user_id
    }
    await db.files.insert_one(file_meta)

    # 4. Instant update memory cache for zero-latency dashboard rendering
    data_cache[file_id] = {
        "processor": processor,
        "user_id": user_id
    }
    # Cache only the latest file bytes globally for sheet switching (memory efficient)
    _file_bytes_cache["latest_file_id"] = file_id
    _file_bytes_cache["contents"] = contents
    print(f"💾 File processed: {len(processor.df)} rows, raw bytes cached as latest file")

    # 5. Async background task to persist records without blocking the user
    async def _async_persist_records(f_id: str, df_data: pd.DataFrame):
        try:
            total_rows = len(df_data)
            db_chunk_size = 250 if total_rows > 5000 else 500 if total_rows > 10000 else 1000
            datetime_cols = df_data.select_dtypes(include=['datetime', 'datetime64', 'datetimetz']).columns

            print(f"💾 Starting chunked DB insertion: {total_rows} rows, chunk_size={db_chunk_size}")

            for start in range(0, total_rows, db_chunk_size):
                # Only process and convert SMALL CHUNK at a time, not entire df
                chunk_df = df_data.iloc[start:start + db_chunk_size].copy()

                # Convert datetime columns
                for col in datetime_cols:
                    chunk_df[col] = chunk_df[col].dt.strftime('%Y-%m-%d %H:%M:%S').fillna('')

                # Replace NaN with None
                chunk_df = chunk_df.replace({np.nan: None})

                # Convert to dict - only for this small chunk
                recs = chunk_df.to_dict('records')

                # Add file_id and handle item()
                for r in recs:
                    r['file_id'] = f_id
                    for k, v in r.items():
                        if hasattr(v, 'item'):
                            r[k] = v.item()

                # Insert this chunk
                await db.records.insert_many(recs)

                # Cleanup memory immediately
                del chunk_df, recs
                if start % (db_chunk_size * 5) == 0:
                    gc.collect()
                    print(f"🧹 Memory cleanup after {start} records")

            print(f"✅ Completed DB insertion for {total_rows} records")

        except Exception as err:
            print(f"⚠️ [Background Sync Warning] Persistent record sync error: {err}")

    import asyncio
    asyncio.create_task(_async_persist_records(file_id, processor.df))

    return {
        "file_id": file_id,
        "filename": file.filename,
        "sheet_names": sheet_names,
        "selected_sheet": selected_sheet,
        "row_count": len(processor.df)
    }


@app.post("/api/select-sheet/{file_id}")
async def select_sheet(
    file_id: str,
    sheet_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Re-load dataset with selected sheet name (requires re-upload for memory efficiency)."""
    # Check if this is the latest cached file
    if _file_bytes_cache["latest_file_id"] != file_id or _file_bytes_cache["contents"] is None:
        raise HTTPException(
            status_code=400,
            detail="File session đã hết hạn để tiết kiệm memory. Vui lòng upload lại file để đổi sheet."
        )

    contents = _file_bytes_cache["contents"]
    user_id = current_user["_id"]

    # Determine chunk size based on file size
    file_size = len(contents)
    chunk_size = 1000 if file_size > 5 * 1024 * 1024 else None

    processor = TransportDataProcessor.load_excel(contents, sheet_name=sheet_name, chunk_size=chunk_size)

    db = get_database()
    await db.records.delete_many({"file_id": file_id})
    await db.files.update_one({"_id": file_id}, {"$set": {"sheet_name": sheet_name, "row_count": len(processor.df)}})

    data_cache[file_id] = {
        "processor": processor,
        "user_id": user_id
    }

    async def _async_persist_sheet_records(f_id: str, df_data: pd.DataFrame):
        try:
            total_rows = len(df_data)
            db_chunk_size = 250 if total_rows > 5000 else 500 if total_rows > 10000 else 1000
            datetime_cols = df_data.select_dtypes(include=['datetime', 'datetime64', 'datetimetz']).columns

            print(f"💾 Starting chunked DB insertion (sheet change): {total_rows} rows, chunk_size={db_chunk_size}")

            for start in range(0, total_rows, db_chunk_size):
                # Only process and convert SMALL CHUNK at a time
                chunk_df = df_data.iloc[start:start + db_chunk_size].copy()

                # Convert datetime columns
                for col in datetime_cols:
                    chunk_df[col] = chunk_df[col].dt.strftime('%Y-%m-%d %H:%M:%S').fillna('')

                # Replace NaN with None
                chunk_df = chunk_df.replace({np.nan: None})

                # Convert to dict - only for this small chunk
                recs = chunk_df.to_dict('records')

                # Add file_id and handle item()
                for r in recs:
                    r['file_id'] = f_id
                    for k, v in r.items():
                        if hasattr(v, 'item'):
                            r[k] = v.item()

                # Insert this chunk
                await db.records.insert_many(recs)

                # Cleanup memory immediately
                del chunk_df, recs
                if start % (db_chunk_size * 5) == 0:
                    gc.collect()
                    print(f"🧹 Memory cleanup after {start} records (sheet change)")

            print(f"✅ Completed DB insertion for {total_rows} records (sheet change)")

        except Exception as err:
            print(f"⚠️ [Background Sync Warning] Persistent record sync error: {err}")

    import asyncio
    asyncio.create_task(_async_persist_sheet_records(file_id, processor.df))

    return {
        "file_id": file_id,
        "selected_sheet": sheet_name,
        "row_count": len(processor.df)
    }


def parse_filter_params(
    carrier: Optional[List[str]] = Query(None, alias="carrier[]"),
    carrier_single: Optional[List[str]] = Query(None, alias="carrier"),
    province: Optional[List[str]] = Query(None, alias="province[]"),
    province_single: Optional[List[str]] = Query(None, alias="province"),
    delivery_type: Optional[List[str]] = Query(None, alias="delivery_type[]"),
    delivery_type_single: Optional[List[str]] = Query(None, alias="delivery_type"),
    route_code: Optional[List[str]] = Query(None, alias="route_code[]"),
    route_code_single: Optional[List[str]] = Query(None, alias="route_code"),
    years: Optional[List[int]] = Query(None, alias="years[]"),
    years_single: Optional[List[int]] = Query(None, alias="years"),
    months: Optional[List[int]] = Query(None, alias="months[]"),
    months_single: Optional[List[int]] = Query(None, alias="months"),
    exclude_return: bool = Query(True),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
) -> dict:
    """Helper to consolidate array params sent via Axios param[] or param aliases."""
    c_list = carrier or carrier_single or []
    p_list = province or province_single or []
    d_list = delivery_type or delivery_type_single or []
    r_list = route_code or route_code_single or []
    y_list = years or years_single or []
    m_list = months or months_single or []

    return {
        "carrier": c_list,
        "province": p_list,
        "delivery_type": d_list,
        "route_code": r_list,
        "years": y_list,
        "months": m_list,
        "exclude_return": exclude_return,
        "start_date": start_date,
        "end_date": end_date
    }


@app.get("/api/dashboard/{file_id}")
async def get_dashboard(
    file_id: str,
    filters: dict = Depends(parse_filter_params),
    current_user: dict = Depends(get_current_user)
):
    """Return KPIs and chart series for dashboard."""
    processor = await get_processor(file_id, current_user)
    kpis = processor.get_kpis(filters)
    charts = processor.get_charts_data(filters)
    return {
        "kpis": kpis,
        "charts": charts
    }


@app.get("/api/filters/{file_id}")
async def get_filters(
    file_id: str,
    filters: dict = Depends(parse_filter_params),
    current_user: dict = Depends(get_current_user)
):
    """Return cascading filter options."""
    processor = await get_processor(file_id, current_user)
    options = processor.get_filter_options(filters)
    return options


@app.get("/api/table/{file_id}")
async def get_table_data(
    file_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    sort_by: Optional[str] = Query(None),
    sort_order: str = Query('asc'),
    search: Optional[str] = Query(None),
    filters: dict = Depends(parse_filter_params),
    current_user: dict = Depends(get_current_user)
):
    """Return paginated raw records."""
    processor = await get_processor(file_id, current_user)
    table_data = processor.get_table_data(
        filters=filters,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
        search=search
    )
    return table_data


@app.get("/api/export/{file_id}")
async def export_excel(
    file_id: str,
    filters: dict = Depends(parse_filter_params),
    current_user: dict = Depends(get_current_user)
):
    """Stream multi-sheet Excel export."""
    processor = await get_processor(file_id, current_user)
    excel_bytes = processor.export_excel(filters)

    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=TransportData_Export_{file_id[:8]}.xlsx"}
    )


@app.get("/api/carrier-routes/{file_id}")
async def get_carrier_routes(
    file_id: str,
    carrier_name: str = Query(..., description="Tên nhà vận chuyển cần phân tích"),
    group_by: str = Query("month", description="Nhóm theo: 'week' hoặc 'month'"),
    filters: dict = Depends(parse_filter_params),
    current_user: dict = Depends(get_current_user)
):
    """Return route-level tonnage breakdown (by route_code x time) for a specific carrier."""
    processor = await get_processor(file_id, current_user)
    data = processor.get_carrier_routes(carrier_name, group_by, filters)
    return data


@app.delete("/api/file/{file_id}")
async def delete_file(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Xóa toàn bộ dữ liệu của file (records + metadata) khỏi DB và RAM cache."""
    user_id = current_user["_id"]
    is_admin = (current_user.get("role") == "admin")

    db = get_database()
    file_doc = await db.files.find_one({"_id": file_id})
    if not file_doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy file.")

    if not is_admin and file_doc.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa file này.")

    # 1. Xóa tất cả records có file_id tương ứng trong DB
    delete_records_res = await db.records.delete_many({"file_id": file_id})

    # 2. Xóa metadata của file trong collection files DB
    delete_file_res = await db.files.delete_one({"_id": file_id})

    # 3. Xóa triệt để khỏi bộ nhớ RAM cache
    data_cache.pop(file_id, None)
    # Clear global file bytes cache if this was the latest file
    if _file_bytes_cache["latest_file_id"] == file_id:
        _file_bytes_cache["latest_file_id"] = None
        _file_bytes_cache["contents"] = None

    return {
        "message": "Đã xóa toàn bộ dữ liệu file thành công.",
        "file_id": file_id,
        "deleted_records": getattr(delete_records_res, 'deleted_count', 0),
        "deleted_files": getattr(delete_file_res, 'deleted_count', 0)
    }
