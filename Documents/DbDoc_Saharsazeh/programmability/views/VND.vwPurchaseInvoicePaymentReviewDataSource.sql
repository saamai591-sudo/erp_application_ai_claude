------------------------------------- START #7746
CREATE   View Vnd.vwPurchaseInvoicePaymentReviewDataSource
as 

---PrePayment Created on PaymentReceipt
SELECT pr.BranchID,
       pr.DLID,
       pr.CurrencyID,
       pr.CurrencyRate,
       pr.TotalNetPrice Amount,
       0.0 as PaidAmount,
       pr.PurchaseInvoiceID      AS DocumentID,
       'PurchaseInvoice'         AS Document,
       pr.PurchaseInvoiceID DocumentItemID,
       pr.PurchaseInvoiceID as BaseDocumentID,
       pr.[Date] DocumentDate,
       pr.[Date] BaseDocumentDate,
       pr.Number DocumentNumber
FROM   vnd.PurchaseInvoice   AS pr

UNION ALL

---Invoice paid on paymentreceipt
SELECT pi1.BranchID,
       pi1.DlID,
       pi1.CurrencyID,
       ps.CurrencyRate,
       0,
       ps.Amount as DepreciatedAmount,
       pr.PaymentReceiptID      AS DocumentID,
       'PaymentReceipt'         AS DOCUMENT,
       ps.PaymentSubjectID DocumentItemID,
       pi1.PurchaseInvoiceID as BaseDocumentItemID,
       pr.[Date] DocumentDate,
       pi1.[Date] BaseDocumentDate,
       pr.Number
FROM   fin.PaymentSubject AS ps
join fin.PaymentReceipt AS pr on pr.PaymentReceiptID = ps.PaymentReceiptID
join vnd.PurchaseInvoice AS pi1 on pi1.PurchaseInvoiceID = ps.PurchaseInvoiceID

UNION ALL
---InvoicePrepayment based on paymentsubject
SELECT pr.BranchID,
       pr.DLID,
       pr.CurrencyID,
       pr.CurrencyRate,
       0 PurchaseInvoiceNetAmount,
       pipp.Price as DepreciatedAmount,
       pr2.PaymentReceiptID      AS DocumentID,
       'PaymentReceipt'         AS Document,
       ps.PaymentSubjectID DocumentItemID,
       pr.PurchaseInvoiceID as  BaseDocumentItemID,
       pr2.[Date] DocumentDate,
       pr.[Date] BaseDocumentDate,
       pr2.Number DocumentNumber
FROM   vnd.PurchaseInvoice   AS pr
join vnd.PurchaseInvoicePrePayment AS pipp on pipp.PurchaseInvoiceID = pr.PurchaseInvoiceID
join fin.PaymentSubject AS ps on ps.PaymentSubjectID = pipp.PaymentSubjectID
join fin.PaymentReceipt AS pr2 on pr2.PaymentReceiptID = ps.PaymentReceiptID
UNION ALL
---InvoicePrepayment based on PettyCash
SELECT pr.BranchID,
       pr.DLID,
       pr.CurrencyID,
       pr.CurrencyRate,
       0 PurchaseInvoiceNetAmount,
       pipp.Price as DepreciatedAmount,
       pcc.PettyCashCostID      AS DocumentID,
       'PettyCashCost'         AS Document,
       pcci.PettyCashCostItemID DocumentItemID,
       pr.PurchaseInvoiceID as  BaseDocumentItemID,
       pcc.[Date] DocumentDate,
       pr.[Date] BaseDocumentDate,
       pcc.Number DocumentNumber
FROM   vnd.PurchaseInvoice   AS pr
join vnd.PurchaseInvoicePrePayment AS pipp on pipp.PurchaseInvoiceID = pr.PurchaseInvoiceID
join fin.PettyCashCostItem AS pcci on pcci.PettyCashCostItemID = pipp.PettyCashCostItemID
join fin.PettyCashCost AS pcc on pcc.PettyCashCostID = pcci.PettyCashCostID
UNION ALL
---InvoicePrepayment based on PettyCash
SELECT pr.BranchID,
       pr.DLID,
       pr.CurrencyID,
       pr.CurrencyRate,
       0 PurchaseInvoiceNetAmount,
       pipp.Price as DepreciatedAmount,
       dcn.DebitCreditNoteID    AS DocumentID,
       'DebitCreditNote'         AS Document,
       dcni.DebitCreditNoteItemID DocumentItemID,
       pr.PurchaseInvoiceID as  BaseDocumentItemID,
       dcn.[Date] DocumentDate,
       pr.[Date] BaseDocumentDate,
       dcn.Number DocumentNumber
FROM   vnd.PurchaseInvoice   AS pr
join vnd.PurchaseInvoicePrePayment AS pipp on pipp.PurchaseInvoiceID = pr.PurchaseInvoiceID
join cfg.DebitCreditNoteItem AS dcni on dcni.DebitCreditNoteItemID = pipp.DebitCreditNoteItemID
join cfg.DebitCreditNote AS dcn on dcn.DebitCreditNoteID = dcni.DebitCreditNoteID
UNION ALL

---Invoice paid on PettyCash
SELECT pi1.BranchID,
       pi1.DlID,
       pi1.CurrencyID,
       pi1.CurrencyRate,
       0,
       pcci.Amount as DepreciatedAmount,
       pcc.PettyCashCostID      AS DocumentID,
       'PettyCashCost'         AS DOCUMENT,
       pcci.PettyCashCostItemID DocumentItemID,
       pi1.PurchaseInvoiceID as BaseDocumentItemID,
       pcc.[Date] DocumentDate,
       pi1.[Date] BaseDocumentDate,
       pcc.Number
FROM   fin.PettyCashCostItem AS pcci
join fin.PettyCashCost AS pcc on pcc.PettyCashCostID = pcci.PettyCashCostID
join vnd.PurchaseInvoice AS pi1 on pi1.PurchaseInvoiceID = pcci.PurchaseInvoiceID
UNION ALL

---Invoice paid on ManualReceipt
SELECT pi1.BranchID,
       pi1.DlID,
       pi1.CurrencyID,
       pi1.CurrencyRate,
       0,
       mr.Amount as DepreciatedAmount,
       mr.ManualReceiptID      AS DocumentID,
       'ManualReceipt'         AS DOCUMENT,
       mr.ManualReceiptID DocumentItemID,
       pi1.PurchaseInvoiceID as BaseDocumentItemID,
       mr.[Date] DocumentDate,
       pi1.[Date] BaseDocumentDate,
       mr.Number
FROM   cfg.ManualReceipt AS mr
join vnd.PurchaseInvoice AS pi1 on pi1.PurchaseInvoiceID = mr.PurchaseInvoiceID

UNION ALL

---Invoice paid on DebitCreditNote
SELECT pi1.BranchID,
       pi1.DlID,
       pi1.CurrencyID,
       pi1.CurrencyRate,
       0,
       dcni.Amount as DepreciatedAmount,
       dcn.DebitCreditNoteID      AS DocumentID,
       'DebitCreditNote'         AS DOCUMENT,
       dcni.DebitCreditNoteItemID DocumentItemID,
       pi1.PurchaseInvoiceID as BaseDocumentItemID,
       dcn.[Date] DocumentDate,
       pi1.[Date] BaseDocumentDate,
       dcn.Number
FROM   cfg.DebitCreditNoteItem AS dcni
join cfg.DebitCreditNote AS dcn on dcn.DebitCreditNoteID = dcni.DebitCreditNoteID
join vnd.PurchaseInvoice AS pi1 on pi1.PurchaseInvoiceID = dcni.PurchaseInvoiceID

UNION ALL

---Invoice Returned
SELECT pi1.BranchID,
       pi1.DlID,
       pi1.CurrencyID,
       pi1.CurrencyRate,
       0,
       rii.Net as DepreciatedAmount,
       ri.ReturnInvoiceID      AS DocumentID,
       'ReturnInvoice'         AS DOCUMENT,
       rii.ReturnInvoiceItemID DocumentItemID,
       pi1.PurchaseInvoiceID as BaseDocumentItemID,
       ri.[Date] DocumentDate,
       pi1.[Date] BaseDocumentDate,
       ri.Number
FROM   vnd.ReturnInvoiceItem AS rii 
join vnd.ReturnInvoice AS ri on ri.ReturnInvoiceID = rii.ReturnInvoiceID
join vnd.PurchaseInvoiceItem AS pii on pii.PurchaseInvoiceItemID = rii.PurchaseInvoiceItemID
join vnd.PurchaseInvoice AS pi1 on pi1.PurchaseInvoiceID = pii.PurchaseInvoiceID

UNION ALL

---Invoice On Installment
SELECT pi1.BranchID,
       pi1.DlID,
       pi1.CurrencyID,
       pi1.CurrencyRate,
       0,
       ipi.Amount as DepreciatedAmount,
       i.InstallmentPaymentID      AS DocumentID,
       'InstallmentPayment'         AS DOCUMENT,
       ipi.InstallmentPaymentItemID DocumentItemID,
       pi1.PurchaseInvoiceID as BaseDocumentItemID,
       i.[Date] DocumentDate,
       pi1.[Date] BaseDocumentDate,
       i.Number
FROM   cfg.InstallmentPayment AS i
join vnd.PurchaseInvoice AS pi1 on i.DocumentID = pi1.PurchaseInvoiceID and i.BaseType = 4
join cfg.InstallmentPaymentItem AS ipi on ipi.InstallmentPaymentID = i.InstallmentPaymentID

UNION ALL

---Invoice Received on Receive Subject
SELECT pi1.BranchID,
       pi1.DlID,
       pi1.CurrencyID,
       pi1.CurrencyRate,
       0,
       -rs.Amount as DepreciatedAmount,
       rr.ReceiveReceiptID      AS DocumentID,
       'ReceiveReceipt'         AS DOCUMENT,
       rs.ReceiveSubjectID DocumentItemID,
       pi1.PurchaseInvoiceID as BaseDocumentItemID,
       rr.[Date] DocumentDate,
       pi1.[Date] BaseDocumentDate,
       rr.Number
FROM  fin.ReceiveSubject AS rs 
join vnd.PurchaseInvoice AS pi1 on pi1.PurchaseInvoiceID = rs.PurchaseInvoiceID
join fin.ReceiveReceipt AS rr on rr.ReceiveReceiptID = rs.ReceiveReceiptID

UNION ALL

---Invoice Received on DebitCreditNote
SELECT pi1.BranchID,
       pi1.DlID,
       pi1.CurrencyID,
       pi1.CurrencyRate,
       0,
       -dcni.Amount as DepreciatedAmount,
       dcn.DebitCreditNoteID      AS DocumentID,
       'DebitCreditNote'         AS DOCUMENT,
       dcni.DebitCreditNoteItemID DocumentItemID,
       pi1.PurchaseInvoiceID as BaseDocumentItemID,
       dcn.[Date] DocumentDate,
       pi1.[Date] BaseDocumentDate,
       dcn.Number
FROM  cfg.DebitCreditNoteItem AS dcni 
join vnd.PurchaseInvoice AS pi1 on pi1.PurchaseInvoiceID = dcni.PurchaseInvoiceID and dcni.[Type] = 1
join cfg.DebitCreditNote AS dcn on dcn.DebitCreditNoteID = dcni.DebitCreditNoteID

UNION ALL

---Invoice Received on CreditAllocation on fos
SELECT pi1.BranchID,
       pi1.DlID,
       pi1.CurrencyID,
       pi1.CurrencyRate,
       0,
       cai.Amount as DepreciatedAmount,
       ca.CreditAllocationID      AS DocumentID,
       'CreditAllocation'         AS DOCUMENT,
       cai.CreditAllocationItemID DocumentItemID,
       pi1.PurchaseInvoiceID as BaseDocumentItemID,
       ca.[Date] DocumentDate,
       pi1.[Date] BaseDocumentDate,
       ca.Number
FROM  fos.CreditAllocationItem AS cai
join fos.CreditAllocation AS ca on ca.CreditAllocationID = cai.CreditAllocationID
join vnd.PurchaseInvoice AS pi1 on pi1.PurchaseInvoiceID = cai.PurchaseInvoiceID
UNION ALL

---Invoice Payed on Check but Check has been drawed back
SELECT pi1.BranchID,
       pi1.DlID,
       pi1.CurrencyID,
       pi1.CurrencyRate,
       0,
       -a.Amount as DepreciatedAmount,
       pr.PaymentReceiptID      AS DocumentID,
       'PaymentReceipt'         AS DOCUMENT,
       a.PaymentSubjectID DocumentItemID,
       pi1.PurchaseInvoiceID as BaseDocumentItemID,
       pr.[Date] DocumentDate,
       pi1.[Date] BaseDocumentDate,
       pr.Number
FROM   Fin.PaymentSubject a
	join fin.PaymentCheqe b
		on a.PaymentCheqeID = b.PaymentCheqeID and b.LastState = 2
		join fin.PaymentReceipt AS pr on pr.PaymentReceiptID = a.PaymentReceiptID
	join vnd.PurchaseInvoice AS pi1 on pi1.PurchaseInvoiceID = a.PurchaseInvoiceID
	
	UNION ALL

---Invoice Payed on OtherCheck but Check has been drawed back
SELECT pi1.BranchID,
       pi1.DlID,
       pi1.CurrencyID,
       pi1.CurrencyRate,
       0,
       -ps.Amount as DepreciatedAmount,
       pr.PaymentReceiptID      AS DocumentID,
       'PaymentReceipt'         AS DOCUMENT,
       ps.PaymentSubjectID DocumentItemID,
       pi1.PurchaseInvoiceID as BaseDocumentItemID,
       pr.[Date] DocumentDate,
       pi1.[Date] BaseDocumentDate,
       pr.Number
	from fin.PaymentSubject ps
	join fin.PaymentOtherCheqe poc on ps.PaymentOtherCheqeID = poc.PaymentOtherCheqeID
	join FIN.ReceiptCheqeFlowItem rcfi on rcfi.ReceiptCheqeFlowItemID = poc.ReceiptCheqeFlowItemID
	join fin.ReceiptCheqeFlowItem rcfi2 on rcfi.ReceiptCheqeFlowItemID = rcfi2.PreviousFlow
	join fin.ReceivedCheqe rc on rc.ReceivedCheqeID = poc.ReceivedCheqeID
	join fin.PaymentReceipt AS pr on pr.PaymentReceiptID = ps.PaymentReceiptID
	join vnd.PurchaseInvoice AS pi1 on pi1.PurchaseInvoiceID = ps.PurchaseInvoiceID

