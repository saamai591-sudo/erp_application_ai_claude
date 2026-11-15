
CREATE   Proc REQ.SpPurchaseRequestFlow
as 

create table #PurchaseRequestFlow
(
PurchaseRequestItemID int,
TemporaryStockReceiptItemID int,
JustificationInputItemID int,
StockReceiptItemID int,
PurchaseInvoiceItemID int,
PurchaseContractItemID int,
ProposalItemID int,
TemporaryStockReceiptQuantity decimal(36,10),
JustificationInputQuantity    decimal(36,10),
StockReceiptQuantity          decimal(36,10),
PurchaseInvoiceQuantity       decimal(36,10),
PurchaseContractQuantity      decimal(36,10),
ProposalQuantity			  decimal(36,10)
)

--Request>Proposal
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
PI.ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
PI.MainQuantity ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID

-- Contract
Begin
--Request>Contract
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
PCI.PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
PCI.MainQuantity PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseContractItem PCI on PCI.PurchaseRequestItemID = PRI.PurchaseRequestItemID

--Request>Proposal>Contract
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
PCI.PurchaseContractItemID,
Null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
PCI.MainQuantity PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseContractItem PCI on PCI.ProposalItemID = pi.ProposalItemID
End 


-- Temporary
Begin
--Request>Temporary
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
tsri.TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
tsri.MainQuantity TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join stc.TemporaryStockReceiptItem tsri on PRI.PurchaseRequestItemID = tsri.PurchaseRequestItemID

--Request>Proposal>Temporary
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
tsri.TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
tsri.MainQuantity TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.TemporaryStockReceiptItem tsri on PI.ProposalItemID = tsri.ProposalItemID

--Request>Contract>Temporary
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
tsri.TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
tsri.MainQuantity TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseContractItem PCI on PCI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.TemporaryStockReceiptItem tsri on PCI.PurchaseContractItemID = tsri.PurchaseContractItemID

--Request>Proposal>Contract>Temporary
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
tsri.TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
tsri.MainQuantity TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseContractItem PCI on PCI.ProposalItemID = PI.ProposalItemID
join stc.TemporaryStockReceiptItem tsri on PCI.PurchaseContractItemID = tsri.PurchaseContractItemID

--Request>Invoice>Temporary
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
tsri.TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
tsri.MainQuantity TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseInvoiceItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.TemporaryStockReceiptItem tsri on PI.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID

--Request>Proposal>Invoice>Temporary
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
tsri.TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
tsri.MainQuantity TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseInvoiceItem PI2 on PI2.ProposalItemID = PI.ProposalItemID
join stc.TemporaryStockReceiptItem tsri on PI2.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID

--Request>Contract>Invoice>Temporary
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
tsri.TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
tsri.MainQuantity TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseContractItem PCI on PCI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseInvoiceItem PI2 on PI2.PurchaseContractItemID = PCI.PurchaseContractItemID
join stc.TemporaryStockReceiptItem tsri on PI2.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID

--Request>Proposal>Contract>Invoice>Temporary
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
tsri.TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
tsri.MainQuantity TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseContractItem PCI on PCI.ProposalItemID = PI.ProposalItemID
join vnd.PurchaseInvoiceItem PI2 on PI2.PurchaseContractItemID = PCI.PurchaseContractItemID
join stc.TemporaryStockReceiptItem tsri on PI2.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID
End 

--Justification
Begin
--Request>Temporary>Justification
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
jii.JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
jii.MainQuantity JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI 
join stc.TemporaryStockReceiptItem tsri on PRI.PurchaseRequestItemID = tsri.PurchaseRequestItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID

--Request>Proposal>Temporary>Justification
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
jii.JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
jii.MainQuantity JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.TemporaryStockReceiptItem tsri on PI.ProposalItemID = tsri.ProposalItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID

--Request>Contract>Temporary>Justification
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
jii.JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
jii.MainQuantity JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseContractItem PCI on PCI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.TemporaryStockReceiptItem tsri on PCI.PurchaseContractItemID = tsri.PurchaseContractItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID

--Request>Proposal>Contract>Temporary>Justification
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
jii.JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
jii.MainQuantity JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseContractItem PCI on PCI.ProposalItemID = PI.ProposalItemID
join stc.TemporaryStockReceiptItem tsri on PCI.PurchaseContractItemID = tsri.PurchaseContractItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID

--Request>Invoice>Temporary>Justification
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
jii.JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
jii.MainQuantity JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseInvoiceItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.TemporaryStockReceiptItem tsri on PI.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID

--Request>Proposal>Invoice>Temporary>Justification
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
jii.JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
jii.MainQuantity JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseInvoiceItem PI2 on PI2.ProposalItemID = PI.ProposalItemID
join stc.TemporaryStockReceiptItem tsri on PI2.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID

--Request>Contract>Invoice>Temporary>Justification
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
jii.JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
jii.MainQuantity JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseContractItem PCI on PCI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseInvoiceItem PI2 on PI2.PurchaseContractItemID = PCI.PurchaseContractItemID
join stc.TemporaryStockReceiptItem tsri on PI2.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID

--Request>Proposal>Contract>Invoice>Temporary>Justification
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
jii.JustificationInputItemID,
Null StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
jii.MainQuantity JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseContractItem PCI on PCI.ProposalItemID = PI.ProposalItemID
join vnd.PurchaseInvoiceItem PI2 on PI2.PurchaseContractItemID = PCI.PurchaseContractItemID
join stc.TemporaryStockReceiptItem tsri on PI2.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
end
--- StockReceipt
Begin
--Request>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI 
join stc.StockReceiptItem sri on PRI.PurchaseRequestItemID = sri.PurchaseRequestItemID

--Request>Proposal>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.StockReceiptItem sri on PRI.PurchaseRequestItemID = sri.PurchaseRequestItemID

--Request>Contract>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseContractItem PCI on PCI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.StockReceiptItem sri on PCI.PurchaseContractItemID = sri.PurchaseContractItemID

--Request>Proposal>Contract>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseContractItem PCI on PCI.ProposalItemID = pi.ProposalItemID
join stc.StockReceiptItem sri on PCI.PurchaseContractItemID = sri.PurchaseContractItemID

--Request>Temporary>Justification>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join stc.TemporaryStockReceiptItem tsri on PRI.PurchaseRequestItemID = tsri.PurchaseRequestItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID

--Request>Proposal>Temporary>Justification>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.TemporaryStockReceiptItem tsri on PI.ProposalItemID = tsri.ProposalItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID

--Request>Contract>Temporary>Justification>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseContractItem PCI on PCI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.TemporaryStockReceiptItem tsri on PCI.PurchaseContractItemID = tsri.PurchaseContractItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID

--Request>Proposal>Contract>Temporary>Justification>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseContractItem PCI on PCI.ProposalItemID = PI.ProposalItemID
join stc.TemporaryStockReceiptItem tsri on PCI.PurchaseContractItemID = tsri.PurchaseContractItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID

--Request>Invoice>Temporary>Justification>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseInvoiceItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.TemporaryStockReceiptItem tsri on PI.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID

--Request>Proposal>Invoice>Temporary>Justification>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseInvoiceItem PI2 on PI2.ProposalItemID = PI.ProposalItemID
join stc.TemporaryStockReceiptItem tsri on PI2.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID

--Request>Contract>Invoice>Temporary>Justification>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseContractItem PCI on PCI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseInvoiceItem PI2 on PI2.PurchaseContractItemID = PCI.PurchaseContractItemID
join stc.TemporaryStockReceiptItem tsri on PI2.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID

--Request>Proposal>Contract>Invoice>Temporary>Justification>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseContractItem PCI on PCI.ProposalItemID = PI.ProposalItemID
join vnd.PurchaseInvoiceItem PI2 on PI2.PurchaseContractItemID = PCI.PurchaseContractItemID
join stc.TemporaryStockReceiptItem tsri on PI2.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID

--Request>Invoice>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI 
join vnd.PurchaseInvoiceItem pii on PRI.PurchaseRequestItemID = pii.PurchaseRequestItemID
join stc.StockReceiptItem sri on pii.PurchaseInvoiceItemID = sri.PurchaseInvoiceItemID

--Request>Proposal>Invoice>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseInvoiceItem pii on PI.ProposalItemID = pii.ProposalItemID
join stc.StockReceiptItem sri on pii.PurchaseInvoiceItemID = sri.PurchaseInvoiceItemID

--Request>Contract>Invoice>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseContractItem PCI on PCI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseInvoiceItem pii on PCI.PurchaseContractItemID = pii.PurchaseContractItemID
join stc.StockReceiptItem sri on pii.PurchaseInvoiceItemID = sri.PurchaseInvoiceItemID

--Request>Proposal>Contract>Invoice>StockReceipt
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
sri.StockReceiptItemID,
Null PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
sri.MainQuantity StockReceiptQuantity        ,
0 PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseContractItem PCI on PCI.ProposalItemID = pi.ProposalItemID
join vnd.PurchaseInvoiceItem pii on PCI.PurchaseContractItemID = pii.PurchaseContractItemID
join stc.StockReceiptItem sri on pii.PurchaseInvoiceItemID = sri.PurchaseInvoiceItemID
end

----Invoice
Begin
--Request>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseInvoiceItem pii on PRI.PurchaseRequestItemID = pii.PurchaseRequestItemID

--Request>Proposal>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseInvoiceItem pii on Pi.ProposalItemID = pii.ProposalItemID

--Request>Contract>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseContractItem PCI on PCI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseInvoiceItem pii on PCI.PurchaseContractItemID = pii.PurchaseContractItemID

--Request>Proposal>Contract>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseContractItem PCI on PCI.ProposalItemID = Pi.ProposalItemID
join vnd.PurchaseInvoiceItem pii on Pci.PurchaseContractItemID = pii.PurchaseContractItemID

--Request>StockReceipt>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI 
join stc.StockReceiptItem sri on PRI.PurchaseRequestItemID = sri.PurchaseRequestItemID
join vnd.PurchaseInvoiceItem pii on sri.StockReceiptItemID = pii.StockReceiptItemID

--Request>Proposal>StockReceipt>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.StockReceiptItem sri on PI.ProposalItemID = sri.ProposalItemID
join vnd.PurchaseInvoiceItem pii on Pii.StockReceiptItemID = sri.StockReceiptItemID

--Request>Contract>StockReceipt>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseContractItem PCI on PCI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.StockReceiptItem sri on sri.PurchaseContractItemID = pci.PurchaseContractItemID
join vnd.PurchaseInvoiceItem pii on sri.StockReceiptItemID = pii.StockReceiptItemID

--Request>Proposal>Contract>StockReceipt>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseContractItem PCI on PCI.ProposalItemID = Pi.ProposalItemID
join stc.StockReceiptItem sri on sri.PurchaseContractItemID = pci.PurchaseContractItemID
join vnd.PurchaseInvoiceItem pii on sri.StockReceiptItemID = pii.StockReceiptItemID

--Request>Temporary>Justification>StockReceipt>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join stc.TemporaryStockReceiptItem tsri on PRI.PurchaseRequestItemID = tsri.PurchaseRequestItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID
join vnd.PurchaseInvoiceItem pii on sri.StockReceiptItemID = pii.StockReceiptItemID

--Request>Proposal>Temporary>Justification>StockReceipt>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.TemporaryStockReceiptItem tsri on PI.ProposalItemID = tsri.ProposalItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID
join vnd.PurchaseInvoiceItem pii on sri.StockReceiptItemID = pii.StockReceiptItemID

--Request>Contract>Temporary>Justification>StockReceipt>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseContractItem PCI on PCI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.TemporaryStockReceiptItem tsri on PCI.PurchaseContractItemID = tsri.PurchaseContractItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID
join vnd.PurchaseInvoiceItem pii on sri.StockReceiptItemID = pii.StockReceiptItemID

--Request>Proposal>Contract>Temporary>Justification>StockReceipt>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseContractItem PCI on PCI.ProposalItemID = PI.ProposalItemID
join stc.TemporaryStockReceiptItem tsri on PCI.PurchaseContractItemID = tsri.PurchaseContractItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID
join vnd.PurchaseInvoiceItem pii on sri.StockReceiptItemID = pii.StockReceiptItemID

--Request>Invoice>Temporary>Justification>StockReceipt>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseInvoiceItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join stc.TemporaryStockReceiptItem tsri on PI.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID
join vnd.PurchaseInvoiceItem pii on sri.StockReceiptItemID = pii.StockReceiptItemID

--Request>Proposal>Invoice>Temporary>Justification>StockReceipt>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseInvoiceItem PI2 on PI2.ProposalItemID = PI.ProposalItemID
join stc.TemporaryStockReceiptItem tsri on PI2.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID
join vnd.PurchaseInvoiceItem pii on sri.StockReceiptItemID = pii.StockReceiptItemID

--Request>Contract>Invoice>Temporary>Justification>StockReceipt>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.PurchaseContractItem PCI on PCI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseInvoiceItem PI2 on PI2.PurchaseContractItemID = PCI.PurchaseContractItemID
join stc.TemporaryStockReceiptItem tsri on PI2.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID
join vnd.PurchaseInvoiceItem pii on sri.StockReceiptItemID = pii.StockReceiptItemID

--Request>Proposal>Contract>Invoice>Temporary>Justification>StockReceipt>Invoice
insert into #PurchaseRequestFlow
select 
PRI.PurchaseRequestItemID,
Null TemporaryStockReceiptItemID,
null JustificationInputItemID,
Null StockReceiptItemID,
pii.PurchaseInvoiceItemID,
null PurchaseContractItemID,
null ProposalItemID,
0 TemporaryStockReceiptQuantity,
0 JustificationInputQuantity  ,
0 StockReceiptQuantity        ,
pii.MainQuantity PurchaseInvoiceQuantity     ,
0 PurchaseContractQuantity,
0 ProposalQuantity
from req.PurchaseRequestItem PRI
join vnd.ProposalItem PI on PI.PurchaseRequestItemID = PRI.PurchaseRequestItemID
join vnd.PurchaseContractItem PCI on PCI.ProposalItemID = PI.ProposalItemID
join vnd.PurchaseInvoiceItem PI2 on PI2.PurchaseContractItemID = PCI.PurchaseContractItemID
join stc.TemporaryStockReceiptItem tsri on PI2.PurchaseInvoiceItemID = tsri.PurchaseInvoiceItemID
join stc.JustificationInputItem jii on tsri.TemporaryStockReceiptItemID = jii.TemporaryStockReceiptItemID
join stc.StockReceiptItem sri on jii.JustificationInputItemID = sri.JustificationInputItemID
join vnd.PurchaseInvoiceItem pii on sri.StockReceiptItemID = pii.StockReceiptItemID
End


select *
from #PurchaseRequestFlow

