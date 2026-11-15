
----------------------------------------------
CREATE   view VND.vwPurchaseContractFlow
as 

select 
pci.PurchaseContractID,
pc.Date,pc.Type PurchaseTypeID,pc.DlID,
pc.BranchID,
pci.PurchaseContractItemID,pci.StuffID,
Null as TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     
from vnd.PurchaseContractItem pci join vnd.PurchaseContract pc on pci.PurchaseContractID = pc.PurchaseContractID

union all
select 
pci.PurchaseContractID,
pc.Date,pc.Type PurchaseTypeID,pc.DlID,
pc.BranchID,
pci.PurchaseContractItemID,pci.StuffID,
tsri.TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
tsri.MainQuantity TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     
from vnd.PurchaseContractItem pci join vnd.PurchaseContract pc on pci.PurchaseContractID = pc.PurchaseContractID
join stc.TemporaryStockReceiptItem tsri on pci.PurchaseContractItemID = tsri.PurchaseContractItemID

 union all
select 
pci.PurchaseContractID,
pc.Date,pc.Type PurchaseTypeID,pc.DlID,
pc.BranchID,
pci.PurchaseContractItemID,pci.StuffID,
Null,
JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
0 TemporaryStockReceiptQuantity,
jii.MainQuantity JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity 
from vnd.PurchaseContractItem pci join vnd.PurchaseContract pc on pci.PurchaseContractID = pc.PurchaseContractID
join stc.TemporaryStockReceiptItem tsri on pci.PurchaseContractItemID = tsri.PurchaseContractItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID

union all

--- StockReceipt
select 
pci.PurchaseContractID,pc.Date,pc.Type PurchaseTypeID,pc.DlID,pc.BranchID,pci.PurchaseContractItemID,pci.StuffID,
Null,
Null,
sri.StockReceiptItemID StockReceiptItemID,
Null PurchaseInvoiceItemID,

0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity 
from vnd.PurchaseContractItem pci join vnd.PurchaseContract pc on pci.PurchaseContractID = pc.PurchaseContractID
join stc.StockReceiptItem sri on pci.PurchaseContractItemID = sri.PurchaseContractItemID

union all
select 
pci.PurchaseContractID,pc.Date,pc.Type PurchaseTypeID,pc.DlID,pc.BranchID,pci.PurchaseContractItemID,pci.StuffID,
Null,
Null,
sri.StockReceiptItemID StockReceiptItemID,
Null PurchaseInvoiceItemID,

0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity 
from vnd.PurchaseContractItem pci join vnd.PurchaseContract pc on pci.PurchaseContractID = pc.PurchaseContractID
join stc.TemporaryStockReceiptItem tsri on pci.PurchaseContractItemID = tsri.PurchaseContractItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID


union all
select 
pci.PurchaseContractID,pc.Date,pc.Type PurchaseTypeID,pc.DlID,pc.BranchID,pci.PurchaseContractItemID,pci.StuffID,
Null,
Null,
sri.StockReceiptItemID StockReceiptItemID,
Null PurchaseInvoiceItemID,

0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity 
from vnd.PurchaseContractItem pci join vnd.PurchaseContract pc on pci.PurchaseContractID = pc.PurchaseContractID
join vnd.PurchaseInvoiceItem pii on pci.PurchaseContractItemID = pii.PurchaseContractItemID
join stc.StockReceiptItem sri on pii.PurchaseInvoiceItemID = sri.PurchaseInvoiceItemID
--- End of StockReceipt

----PurchaseInvoice
union all
select 
pci.PurchaseContractID,pc.Date,pc.Type PurchaseTypeID,pc.DlID,pc.BranchID,pci.PurchaseContractItemID,pci.StuffID,
Null,
Null,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID PurchaseInvoiceItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity 
from vnd.PurchaseContractItem pci join vnd.PurchaseContract pc on pci.PurchaseContractID = pc.PurchaseContractID
join vnd.PurchaseInvoiceItem pii on pci.PurchaseContractItemID = pii.PurchaseContractItemID

union all
select 
pci.PurchaseContractID,pc.Date,pc.Type PurchaseTypeID,pc.DlID,pc.BranchID,pci.PurchaseContractItemID,pci.StuffID,
Null,
Null,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID PurchaseInvoiceItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity 
from vnd.PurchaseContractItem pci join vnd.PurchaseContract pc on pci.PurchaseContractID = pc.PurchaseContractID
join stc.StockReceiptItem sri on pci.PurchaseContractItemID = sri.PurchaseContractItemID
join vnd.PurchaseInvoiceItem pii on sri.StockReceiptItemID = pii.StockReceiptItemID


union all
select 
pci.PurchaseContractID,pc.Date,pc.Type PurchaseTypeID,pc.DlID,pc.BranchID,pci.PurchaseContractItemID,pci.StuffID,
Null,
Null,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID PurchaseInvoiceItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity 
from vnd.PurchaseContractItem pci join vnd.PurchaseContract pc on pci.PurchaseContractID = pc.PurchaseContractID
join stc.TemporaryStockReceiptItem tsri on pci.PurchaseContractItemID = tsri.PurchaseContractItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID
join vnd.PurchaseInvoiceItem pii on sri.StockReceiptItemID = pii.StockReceiptItemID
