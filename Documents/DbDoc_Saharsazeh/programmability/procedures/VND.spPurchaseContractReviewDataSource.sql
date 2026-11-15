CREATE    proc [VND].[spPurchaseContractReviewDataSource]
(@FromDate date,
@ToDate date,
@TableName nvarchar(Max),
@SelectedBranch				nvarchar(MAX) = Null,
@SelectedStuff				nvarchar(MAX) = Null,
@SelectedPurchaseType		nvarchar(MAX) = Null,
@SelectedVendor				nvarchar(MAX) = Null)
as 

declare @Query nvarchar(MAX)

--- Branch
select value BranchID into #SelectedBranch
from CFG.R_FnCommaStr2Table(@SelectedBranch)

select vba.BranchID into #Branch
from cfg.vwBranchAccess vba
left join #SelectedBranch sb on vba.BranchID = sb.BranchID
where (@SelectedBranch is null or sb.BranchID is not null)

--- Stuff
select value StuffID into #SelectedStuff
from CFG.R_FnCommaStr2Table(@SelectedStuff)

select s.StuffID into #Stuff
from STF.VWStuff s 
left join #SelectedStuff sb on s.StuffID = sb.StuffID
where (@SelectedStuff is null or sb.StuffID is not null)

--- PurchaseType
select value PurchaseTypeID into #SelectedPurchaseType
from CFG.R_FnCommaStr2Table(@SelectedPurchaseType)

select pt.PurchaseTypeID 
into #PurchaseType
from vnd.PurchaseType  pt
left join #SelectedPurchaseType spt on pt.PurchaseTypeID = spt.PurchaseTypeID
where (@SelectedPurchaseType is null or pt.PurchaseTypeID is not null)
			
--- Vendor			
select value DlID into #SelectedVendor
from CFG.R_FnCommaStr2Table(@SelectedVendor)

select vpa.DlID 
into #Vendor
from cfg.vwPartyAccess  vpa
left join #SelectedVendor sv on vpa.DlID = sv.DlID
where (@SelectedVendor is null or sv.DlID is not null)

set @Query = N'
Create table '+@TableName + N'
(
PurchaseContractItemID int,
TemporaryStockReceiptQuantity decimal(36,10),
JustificationInputQuantity decimal(36,10),
StockReceiptQuantity decimal(36,10),
PurchaseInvoiceQuantity decimal(36,10)
)'
exec (@Query)

select src.* into #PurchaseContractItem
from vnd.vwPurchaseContractFlow src
join #Branch  vp on src.branchID = vp.BranchID
join #Stuff s on src.stuffid = s.StuffID
join #Vendor v on src.dlid = v.DlID
join #PurchaseType pt on src.PurchaseTypeID = pt.PurchaseTypeID
where src.Date between @FromDate and @ToDate

select PurchaseContractItemID into #PurchaseContractItemFilter
from #PurchaseContractItem
group by PurchaseContractItemID

---TemporaryStockReceipt
select PurchaseContractItemID,sum(TemporaryStockReceiptQuantity) TemporaryStockReceiptQuantity 
into #ContractTemporaryStockReceip
from #PurchaseContractItem
where TemporaryStockReceiptItemID is not null
group by PurchaseContractItemID

---JustificationInput
select PurchaseContractItemID,sum(JustificationInputQuantity) JustificationInputQuantity 
into #ContractJustificationInput
from #PurchaseContractItem
where JustificationInputItemID is not null
group by PurchaseContractItemID

---StockReceipt
select PurchaseContractItemID,sum(StockReceiptQuantity) StockReceiptQuantity
into #ContractStockReceip
from #PurchaseContractItem
where StockReceiptItemID is not null
group by PurchaseContractItemID

---PurchaseInvoice
select PurchaseContractItemID,sum(PurchaseInvoiceQuantity) PurchaseInvoiceQuantity
into #ContractPurchaseInvoice
from #PurchaseContractItem
where PurchaseInvoiceItemID is not null
group by PurchaseContractItemID

select PurchaseContractID,date,branchid into #PurchaseContract
from #PurchaseContractItem
group by PurchaseContractID,date,branchid

set @Query = N'insert into '+ @TableName + N'
select pci.PurchaseContractItemID,ctsr.TemporaryStockReceiptQuantity,cji.JustificationInputQuantity,csr.StockReceiptQuantity,cpi.PurchaseInvoiceQuantity
from  vnd.PurchaseContractItem pci 
join #PurchaseContractItemFilter pc on pci.PurchaseContractItemID = pc.PurchaseContractItemID
left join #ContractTemporaryStockReceip ctsr on pci.PurchaseContractItemID = ctsr.PurchaseContractItemID
left join #ContractJustificationInput cji on pci.PurchaseContractItemID = cji.PurchaseContractItemID
left join #ContractStockReceip csr on pci.PurchaseContractItemID = csr.PurchaseContractItemID
left join #ContractPurchaseInvoice cpi on pci.PurchaseContractItemID = cpi.PurchaseContractItemID
' 
Exec (@Query)
