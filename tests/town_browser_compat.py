"""Protect published product metadata and the intentional Notes price revision."""
from pathlib import Path
import json


def assert_original_furniture_stock(page):
    fixture=json.loads((Path(__file__).parent/'fixtures/town-stock-original-100.json').read_text())
    products=fixture['products']
    assert len(products)==100
    tiers=json.loads((Path(__file__).parent/'fixtures/town-furniture-price-tiers.json').read_text())
    prices=tiers['legacy']
    assert set(prices)=={item['id'] for item in products}
    differences=page.evaluate('''({expected,prices})=>expected.flatMap(old=>{const item=window.CodaFurnitureCatalog.find(p=>p.id===old.id);if(!item)return [{id:old.id,error:'missing'}];const keys=new Set([...Object.keys(old),...Object.keys(item)]);return [...keys].filter(k=>item[k]!== (k==='price'?prices[old.id]:old[k])).map(k=>({id:old.id,field:k,expected:k==='price'?prices[old.id]:old[k],current:item[k]}));})''',{'expected':products,'prices':prices})
    assert not differences,differences
    priced=page.evaluate('''tiers=>window.CodaFurnitureCatalog.map(item=>{const slot=item.collectionOwner&&item.asset.slice(('collection-'+item.collectionOwner+'-').length);return {id:item.id,price:item.price,expected:tiers.playfulProducts?.[item.id]??(item.collectionOwner?tiers.collectionSlots[slot]:tiers.legacy[item.id])};})''',tiers)
    assert len(priced)==484+len(tiers.get('playfulProducts',{}))
    assert all(item['price']==item.get('expected') for item in priced),priced
    return {'originalProducts':100,'referenceCommit':fixture['commit'],'allNonPriceFieldsUnchanged':True,'pricedProducts':len(priced),'pricesMatchNotesTiers':True}
