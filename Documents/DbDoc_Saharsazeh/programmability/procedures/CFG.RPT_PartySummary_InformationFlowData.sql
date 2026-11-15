
CREATE    PROC [CFG].RPT_PartySummary_InformationFlowData
(
	@FromDate Date,
	@ToDate Date,
	@PartyID bigint 
)
--WITH ENCRYPTION 
as
	declare @DlID bigint = null
	select @DlID = DlID from CFG.Party where PartyID = @PartyID

	if object_id('tempdb..#result') is not null
		drop table #result

	create table #result
	(
		EntityName nvarchar(100),
		Number int
	)

	insert into #result
	SELECT 'AssetInsurance' EntityName,
		   count(*) Number								
	FROM AST.Insurance 
	where PartyID = @PartyID and 
		  Date between @FromDate and @ToDate 

	insert into #result
	SELECT 'SellAndDonate' EntityName,
		   count(*) Number								
	FROM AST.Sale 
	where PartyID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'DebitCreditNoteItem' EntityName,
		   count(*) Number	
	from CFG.DebitCreditNoteItem i	
	join CFG.DebitCreditNote d on i.DebitCreditNoteID = d.DebitCreditNoteID
	where i.PartyID = @PartyID and 
		  d.Date between @FromDate and @ToDate	
		
	insert into #result
	SELECT 'PartPayment' EntityName,
		   count(*) Number	
	from CFG.InstallmentPayment 
	where PartyID = @PartyID and 
		  Date between @FromDate and @ToDate
	
	insert into #result
	SELECT 'ManualReceipt' EntityName,
		   count(*) Number	
	FROM CFG.ManualReceipt 
	where PartyID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'ContractDefinition' EntityName,
		   count(*) Number	
	FROM CNT.[Contract] 
	where ParentID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'TenderParticipate' EntityName,
		   count(*) Number	
	FROM VND.TenderParticipate 
	where PartyID = @PartyID and 
		  SecretariatDate between @FromDate and @ToDate	

	insert into #result
	SELECT 'Order' EntityName,
		   count(*) Number	
	FROM CTM.[Order] 
	where CustomerID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'Reception' EntityName,
		   count(*) Number	
	FROM CTM.Reception 
	where CustomerID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'ReceptionTrace' EntityName,
		   count(*) Number	
	FROM CTM.ReceptionTrace 
	where PartyID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'SubscribeCard' EntityName,
		   count(*) Number	
	from CTM.SubscribeCard 
	where PartyID = @PartyID and 
		  IssueDate between @FromDate and @ToDate

	insert into #result
	SELECT 'ReceiveReceipt' EntityName,
		   count(*) Number
	FROM FIN.ReceiveReceipt 
	where PartyID = @PartyID and 
		  Date between @FromDate and @ToDate	

	insert into #result
	SELECT 'PaymentReceipt' EntityName,
		   count(*) Number	
	FROM FIN.PaymentReceipt 
	where PartyID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'PaymentCommitment' EntityName,
		   count(*) Number	
	from FIN.PaymentCommitment 
	where PartyID = @PartyID and 
		  Date between @FromDate and @ToDate
	
	insert into #result
	SELECT 'ReceiveCommitment' EntityName,
		   count(*) Number	
	from FIN.ReceiveCommitment 
	where PartyID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'BillOfLading' EntityName,
		   count(*) Number	
	FROM FOS.BillOfLading 
	where PartyID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'ProformaInvoice' EntityName,
		   count(*) Number	
	FROM FOS.ProformaInvoice
	where Vendor = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'ShippingInsurance' EntityName,
		   count(*) Number	
	FROM FOS.ShippingInsurance 
	where PartyID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'PaymentRequest' EntityName,
		   count(*) Number	
	FROM REQ.PaymentRequest h
	JOIN REQ.PaymentRequestItem i
		ON h.PaymentRequestID = i.PaymentRequestID
	where i.PartyID = @PartyID and 
		  h.Date between @FromDate and @ToDate

	insert into #result
	SELECT 'ReceiveRequest' EntityName,
		   count(*) Number	
	FROM REQ.ReceiveRequest
	where PartyID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'Invoice' EntityName,
		   count(*) Number	
	FROM SLE.Invoice 
	where CustomerID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'Justification' EntityName,
		   count(*) Number	
	FROM SLE.Justification 
	where CustomerID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'Quotation' EntityName,
		   count(*) Number	
	FROM SLE.Quotation 
	where CustomerID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'Remittance' EntityName,
		   count(*) Number	
	FROM SLE.Remittance 
	where CustomerID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'ReturnedSaleInvoice' EntityName,
		   count(*) Number	
	FROM SLE.ReturnedSaleInvoice 
	where CustomerID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'ReturnedSaleJustification' EntityName,
		   count(*) Number	
	FROM SLE.ReturnedSaleJustification 
	where CustomerID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'SaleContract' EntityName,
		   count(*) Number	
	FROM SLE.SaleContract 
	where CustomerID = @PartyID and 
		  Date between @FromDate and @ToDate	

	insert into #result
	SELECT 'Proposal' EntityName,
		   count(*) Number	
	FROM VND.Proposal 
	where PartyID = @PartyID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'ReturnedOutgoing' EntityName,
		   count(*) Number	
	from STC.ReturnedOutgoing 
	where @DlID is not null and
	      DlDeliverID = @DlID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'PaymentCommitmentRecall' EntityName,
		   count(*) Number
	from FIN.PaymentCommitmentRecall 
	where @DlID is not null and
	      DLID = @DlID and 
	      Date between @FromDate and @ToDate

	insert into #result
	SELECT 'ReceiveCommitmentRecall' EntityName,
		   count(*) Number
	from FIN.ReceiveCommitmentRecall 
	where @DlID is not null and
	      DLID = @DlID and 
	      Date between @FromDate and @ToDate

	insert into #result
	SELECT 'StockReceipt' EntityName,
		   count(*) Number
	FROM STC.StockReceipt 
	where @DlID is not null and
	      DeliverDlID = @DlID and
		  Date between @FromDate and @ToDate 

	insert into #result
	SELECT 'ReturnedTemporaryOutgoing' EntityName,
		   count(*) Number
	FROM STC.ReturnedTemporaryOutgoing
	where @DlID is not null and
	      DlID = @DlID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'TemporaryStockReceipt' EntityName,
		   count(*) Number
	FROM STC.TemporaryStockReceipt
	where @DlID is not null and
	      DeliverDlID = @DlID and  
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'PurchaseInvoice' EntityName,
		   count(*) Number
	FROM VND.PurchaseInvoice 
	where @DlID is not null and
	      DlID = @DlID and
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'Outgoing' EntityName,
		   count(*) Number
	FROM STC.Outgoing 
	where @DlID is not null and
	      DeliverDlID = @DlID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'ReturnInvoice' EntityName,
		   count(*) Number
	FROM VND.ReturnInvoice 
	where @DlID is not null and
	      DlID = @DlID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'ReturnStockReceipt' EntityName,
		   count(*) Number
	from STC.ReturnStockReceipt 		
	where @DlID is not null and
	      DeliverDlID = @DlID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'TemporaryOutgoing' EntityName,
		   count(*) Number
	FROM STC.TemporaryOutgoing 
	where @DlID is not null and
	      DlID = @DlID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'ReturnedTemporaryStockReceipt' EntityName,
		   count(*) Number
	FROM STC.ReturnedTemporaryStockReceipt
	where @DlID is not null and
	      DeliverDlID = @DlID and 
	      Date between @FromDate and @ToDate

	insert into #result
	SELECT 'PurchaseContract' EntityName,
		   count(*) Number
	from VND.PurchaseContract
	where @DlID is not null and
	      DlID = @DlID and 
		  Date between @FromDate and @ToDate

	insert into #result
	SELECT 'ReceiveSubject' EntityName,
		   count(*) Number
	from FIN.ReceiveSubject s
	join FIN.ReceiveReceipt r on s.ReceiveReceiptID = r.ReceiveReceiptID
	where @DlID is not null and
	      s.DLID = @DlID and 
		  r.Date between @FromDate and @ToDate

	insert into #result
	SELECT 'PaymentSubject' EntityName,
		   count(*) Number
	from FIN.PaymentSubject s
	join FIN.PaymentReceipt r on s.PaymentReceiptID = r.PaymentReceiptID
	where @DlID is not null and
	      s.DLID = @DlID and 
		  r.Date between @FromDate and @ToDate
		  
	insert into #result
	SELECT 'PettyCashCost' EntityName,
		   count(*) Number
	from FIN.PettyCashCostItem AS pcci
	join fin.PettyCashCost AS pcc on pcc.PettyCashCostID = pcci.PettyCashCostID
	where @DlID is not null and
	      pcci.PartyID = @PartyID and 
		  pcc.Date between @FromDate and @ToDate		  
		  
	select * from #result where Number > 0

	if object_id('tempdb..#result') is not null
		drop table #result
