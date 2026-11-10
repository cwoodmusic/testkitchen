"""Browser compatibility checks against the original published100 products."""
from pathlib import Path
import json


def assert_original_furniture_stock(page):
    fixture=json.loads((Path(__file__).parent/'fixtures/town-stock-original-100.json').read_text())
    products=fixture['products']
    assert len(products)==100
    differences=page.evaluate('''expected=>expected.flatMap(old=>{const item=window.CodaFurnitureCatalog.find(p=>p.id===old.id);if(!item)return [{id:old.id,error:'missing'}];return Object.keys(old).filter(k=>item[k]!==old[k]).map(k=>({id:old.id,field:k,old:old[k],current:item[k]}));})''',products)
    assert not differences,differences
    return {'originalProducts':100,'referenceCommit':fixture['commit'],'allFieldsUnchanged':True}
