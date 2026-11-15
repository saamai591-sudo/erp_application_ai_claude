
CREATE   View CFG.vwPrePaymentDataSource
as 

---PrePayment Created on PaymentReceipt
SELECT pr.BranchID,
	   ps.DLID,
	   ps.CurrencyID,
	   ps.CurrencyRate,
	   ps.Amount,
	   0.0 as DepreciatedAmount,
	   pr.PaymentReceiptID      AS DocumentID,
	   'PaymentReceipt'         AS Document,
	   ps.PaymentSubjectID DocumentItemID,
	   ps.PaymentSubjectID as  BaseDocumentItemID,
	   pr.[Date] DocumentDate,
	   pr.[Date] BaseDocumentDate,
	   pr.Number DocumentNumber
FROM   fin.PaymentReceipt       AS pr
	   JOIN fin.PaymentSubject  AS ps
			ON  ps.PaymentReceiptID = pr.PaymentReceiptID
	   JOIN fin.PaymentType     AS pt
			ON  pt.PaymentTypeID = ps.PaymentTypeID
WHERE  pt.[Type] = 10
UNION ALL

---PrePayment Created on DebitCreditNote
SELECT dcn.BranchID,
	   p.DlID,
	   dcni.CurrencyID,
	   dcni.CurrencyRate,
	   dcni.Amount,
	   0 as DepreciatedAmount,
	   dcn.DebitCreditNoteID      AS DocumentID,
	   'DebitCreditNote'         AS DOCUMENT,
	   dcni.DebitCreditNoteItemID DocumentItemID,
	   dcni.DebitCreditNoteItemID as BaseDocumentItemID,
	   dcn.[Date] DocumentDate,
	   dcn.[Date] BaseDocumentDate,
	   dcn.Number
FROM   cfg.DebitCreditNote AS dcn
	   JOIN cfg.DebitCreditNoteItem AS dcni on dcni.DebitCreditNoteID = dcn.DebitCreditNoteID and dcni.[Type] = 0
	   JOIN fin.PaymentType     AS pt
			ON  pt.PaymentTypeID = dcni.PaymentTypeID
	   join cfg.Party AS p on p.PartyID = dcni.PartyID     
WHERE  pt.[Type] = 10

UNION ALL
---PrePayment Created on PettyCashCostItem
SELECT pcc.BranchID,
	   p.DlID,
	   pc.PettyCashID,
	   pcc.CurrencyRate,
	   pcci.Amount,
	   0 as DepreciatedAmount,
	   pcc.PettyCashCostID      AS DocumentID,
	   'PettyCashCost'         AS DOCUMENT,
	   pcci.PettyCashCostItemID DocumentItemID,
	   pcci.PettyCashCostItemID as BaseDocumentItemID,
	   pcc.[Date] DocumentDate,
	   pcc.[Date] BaseDocumentDate,
	   pcc.Number
FROM   fin.PettyCashCostItem AS pcci
join fin.PettyCashCost AS pcc on pcc.PettyCashCostID = pcci.PettyCashCostID
join fin.PettyCash AS pc on pcc.PettyCashID = pc.PettyCashID
	   JOIN fin.PaymentType     AS pt on pt.PaymentTypeID = pcci.PaymentTypeID
	   join cfg.Party AS p on p.PartyID = pcci.PartyID    
WHERE  pt.[Type] = 10

UNION ALL
---PrePayment Depreciated on DebitCreditNote

SELECT dcn.BranchID,
	   p.DlID,
	   dcni.CurrencyID,
	   dcni.CurrencyRate,
	   0 Amount,
	   dcni.Amount as DepreciatedAmount,
	   dcn.DebitCreditNoteID      AS DocumentID,
	   'DebitCreditNote'         AS Document,
	   dcni.DebitCreditNoteItemID as DocumentItemID,
	   ISNULL(ps.PaymentSubjectID,ISNULL(dcni2.DebitCreditNoteItemID,pcci.PettyCashCostItemID)) BaseDocumentItemID,
	   dcn.[Date] DocumentDate,
	   ISNULL(pr.[Date],ISNULL(dcn2.[Date],pcc.[Date])) BaseDocumentDate,
	   dcn.Number             
FROM   cfg.DebitCreditNote AS dcn
	   JOIN cfg.DebitCreditNoteItem AS dcni on dcni.DebitCreditNoteID = dcn.DebitCreditNoteID and dcni.[Type] = 1
	   JOIN fin.PaymentType     AS pt  ON  pt.PaymentTypeID = dcni.PaymentTypeID
	   join cfg.Party AS p on p.PartyID = dcni.PartyID 
	   left join fin.PaymentSubject AS ps on dcni.PaymentSubjectID = ps.PaymentSubjectID
	   left join fin.PaymentReceipt AS pr on pr.PaymentReceiptID = ps.PaymentReceiptID
	   left join cfg.DebitCreditNoteItem AS dcni2 on dcni.DebitCreditID = dcni2.DebitCreditNoteItemID
	   left join cfg.DebitCreditNote AS dcn2 on dcn2.DebitCreditNoteID = dcni2.DebitCreditNoteID      
	   left join fin.PettyCashCostItem AS pcci on dcni.PettyCashCostItemID = pcci.PettyCashCostItemID
	   left join fin.PettyCashCost AS pcc on pcc.PettyCashCostID = pcci.PettyCashCostID     
WHERE  pt.[Type] = 10
and ISNULL(ps.PaymentSubjectID,ISNULL(dcni2.DebitCreditNoteItemID,pcci.PettyCashCostItemID)) is NOT null

UNION ALL

---PrePayment Depreciated on PurchaseInvoice

SELECT pi1.BranchID,
	   pi1.DlID,
	   pi1.CurrencyID,
	   pi1.CurrencyRate,
	   0 Amount,
	   pipp.Price as DepreciatedAmount,
	   pi1.PurchaseInvoiceID      AS DocumentID,
	   'PurchaseInvoice'         AS DOCUMENT,
	   pipp.PurchaseInvoicePrePaymentID as DocumentItemID,
	   ISNULL(ps.PaymentSubjectID,ISNULL (dcni.DebitCreditNoteItemID,pcci.PettyCashCostItemID)) BaseDocumentItemID ,
	   pi1.[Date] DocumentDate,
	   ISNULL(pr.[Date],ISNULL(dcn.[Date],pcc.[Date])) BaseDocumentDate,
	   pi1.Number
FROM   vnd.PurchaseInvoicePrePayment AS pipp 
join vnd.PurchaseInvoice AS pi1 on pi1.PurchaseInvoiceID = pipp.PurchaseInvoiceID
left join fin.PaymentSubject AS ps on pipp.PaymentSubjectID = ps.PaymentSubjectID
left join fin.PaymentReceipt AS pr on pr.PaymentReceiptID = ps.PaymentReceiptID
left join cfg.DebitCreditNoteItem AS dcni on pipp.DebitCreditNoteItemID = dcni.DebitCreditNoteItemID
left join cfg.DebitCreditNote AS dcn on dcn.DebitCreditNoteID = dcni.DebitCreditNoteID
left join fin.PettyCashCostItem AS pcci on pipp.PettyCashCostItemID = pcci.PettyCashCostItemID
left join fin.PettyCashCost AS pcc on pcc.PettyCashCostID = pcci.PettyCashCostID
WHERE ISNULL(ps.PaymentSubjectID,ISNULL(dcni.DebitCreditNoteItemID,pcci.PettyCashCostItemID)) is NOT NULL


UNION ALL
-- PrePayment Depreciated on ConfirmPurchaseInvoice


SELECT 
ISNULL(pr.BranchID,dcn.BranchID) BranchID,
	   pi1.DlID,
	   ISNULL(ps.CurrencyID,dcni.CurrencyID) CurrencyID,
	   ISNULL(ps.CurrencyRate ,dcni.CurrencyRate) CurrencyRate,
	   0                         Amount,
	   cpiap.Price             AS DepreciatedAmount,
	   cpi.ConfirmPurchaseInvoiceID  AS DocumentID,
	   'ConfirmPurchaseInvoice'      AS DOCUMENT,
	   cpiap.ConfirmPurchaseInvoiceAdvancePaymentID As DocumentItemID,
	   ISNULL(ps.PaymentSubjectID,dcni.DebitCreditNoteItemID) BaseDocumentItemID ,
	   cpi.[Date] DocumentDate,
	   ISNULL(pr.[Date],dcn.[Date]) BaseDocumentDate,
	   cpi.Number      
FROM   vnd.ConfirmPurchaseInvoiceAdvancePayment AS cpiap
	   join vnd.ConfirmPurchaseInvoiceItem AS cpii on cpii.ConfirmPurchaseInvoiceItemID = cpiap.ConfirmPurchaseInvoiceItemID
	   join vnd.ConfirmPurchaseInvoice AS cpi on cpi.ConfirmPurchaseInvoiceID = cpii.ConfirmPurchaseInvoiceID
	   join vnd.PurchaseInvoice AS pi1 on cpi.PurchaseInvoiceID = pi1.PurchaseInvoiceID
	   left join fin.PaymentSubject AS ps on ps.PaymentSubjectID = cpiap.PaymentSubjectID       
	   left join fin.PaymentType AS pt on pt.PaymentTypeID = ps.PaymentTypeID and pt.[Type] = 10
	   left join fin.PaymentReceipt AS pr on pr.PaymentReceiptID = ps.PaymentReceiptID
	   left join cfg.DebitCreditNoteItem AS dcni on dcni.DebitCreditNoteItemID = cpiap.DebitCreditNoteItemID       
	   left join fin.PaymentType AS pt2 on dcni.PaymentTypeID = pt2.PaymentTypeID and pt2.[Type] = 10
	   left join cfg.DebitCreditNote AS dcn on dcn.DebitCreditNoteID = dcni.DebitCreditNoteID
	   WHERE ISNULL(pt.PaymentTypeID,pt2.PaymentTypeID) is NOT null
  
UNION ALL

-- PrePayment Depreciated on ConfirmStatementPrePayment

SELECT 
		ISNULL(pr.BranchID,dcn.BranchID) BranchID,
	   p.DlID,
	   ISNULL(ps.CurrencyID,dcni.CurrencyID) CurrencyID,
	   ISNULL(ps.CurrencyRate ,dcni.CurrencyRate) CurrencyRate,
	   0                         Amount,
	   cspp.Price             AS DepreciatedAmount,
	   cs.ConfirmStatementID  AS DocumentID,
	   'ConfirmStatement'      AS DOCUMENT,
	   cspp.ConfirmStatementPrePaymentID as DocumentItemID,
	   ISNULL(ps.PaymentSubjectID,dcni.DebitCreditNoteItemID) BaseDocumentItemID ,
	   cs.[Date] DocumentDate,
	   ISNULL(pr.[Date],dcn.[Date]),
	   cs.Number
FROM   cnt.ConfirmStatementPrePayment AS cspp
	   join cnt.ConfirmStatementItem AS csi on csi.ConfirmStatementItemID = cspp.ConfirmStatementItemID
	   join cnt.ConfirmStatement AS cs on cs.ConfirmStatementID = csi.ConfirmStatementID
	   join cnt.ContractStatement AS cs2 on cs2.ContractStatementID = cs.ContractStatementID
	   join cfg.Party AS p on p.PartyID = cs2.PartyID
	   left join fin.PaymentSubject AS ps on ps.PaymentSubjectID = cspp.PaymentSubjectID
	   left join fin.PaymentType AS pt on pt.PaymentTypeID = ps.PaymentTypeID and pt.[Type] = 10
	   left join fin.PaymentReceipt AS pr on pr.PaymentReceiptID = ps.PaymentReceiptID       
	   left join cfg.DebitCreditNoteItem AS dcni on dcni.DebitCreditNoteItemID = cspp.DebitCreditNoteItemID
	   left join fin.PaymentType AS pt2 on dcni.PaymentTypeID = pt2.PaymentTypeID and pt2.[Type] = 10
	   left join cfg.DebitCreditNote AS dcn on dcn.DebitCreditNoteID = dcni.DebitCreditNoteID
WHERE ISNULL(pt.PaymentTypeID,pt2.PaymentTypeID) is NOT null
