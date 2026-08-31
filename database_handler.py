import os
import firebase_admin
from firebase_admin import credentials, db

# --- 1. الاتصال المباشر بالفايربيس ---
KEY_FILE = "serviceAccountKey.json"

if os.path.exists(KEY_FILE):
    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(KEY_FILE)
            firebase_admin.initialize_app(cred, {
                'databaseURL': 'https://proj-5252-default-rtdb.firebaseio.com'
            })
        print("✅ تم الاتصال بالفايربيس بنجاح!")
    except Exception as e:
        print(f"❌ خطأ في الاتصال بقاعدة البيانات: {e}")
else:
    print(f"❌ خطأ: لم يتم العثور على ملف {KEY_FILE}!")

# --- 2. دالة الرفع الذكية (تمنع التكرار وتدعم الحقول الجديدة) ---
def upload_deal(product_data, category_name, store_name, product_id=None):
    """
    تحديث احترافي:
    إضافة product_id لضمان عدم تكرار نفس المنتج في القاعدة.
    """
    print(f"📡 جاري معالجة {store_name} -> {category_name}")
    try:
        # إذا أرسلنا ID نستخدمه كعنوان للمنتج، إذا لا نستخدم push التقليدي
        if product_id:
            # الرفع للقسم التخصصي
            ref = db.reference(f'{store_name}/{category_name}/{product_id}')
            ref.update(product_data)
            
            # الرفع لقسم "الكل" 
            all_ref = db.reference(f'{store_name}/All/{product_id}')
            all_ref.update(product_data)
        else:
            # الطريقة القديمة في حال عدم توفر ID
            db.reference(f'{store_name}/{category_name}').push(product_data)
            db.reference(f'{store_name}/All').push(product_data)
            
        print(f"✅ تم الحفظ بنجاح (بيانات مدرجة)!")
    except Exception as e:
        print(f"❌ خطأ في الرفع: {e}")