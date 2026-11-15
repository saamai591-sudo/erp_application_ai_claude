
--------------------------------------------------[FIN].VWPettyCash---------------------------------------------------------
CREATE   VIEW [FIN].VWPettyCash
--with encryption
AS
SELECT pe.PettyCashID,
	   pe.FirstAmount Amount,
	   NULL Date,
	   pe.CurrencyID,
	   -1 BranchID,
	   NULL AS FinancialPeriodID,
	   pe.BankAccountID
FROM FIN.PettyCash pe
UNION ALL
SELECT ps.PettyCashID,
	   ps.Amount,
	   pr.Date,
	   ps.CurrencyID,
	   pr.BranchID,
	   pr.FinancialPeriodID,
	   pc.BankAccountID
FROM FIN.PaymentSubject ps
	JOIN FIN.PaymentType t
		ON ps.PaymentTypeID = t.PaymentTypeID
	JOIN FIN.PaymentReceipt pr
		ON ps.PaymentReceiptID = pr.PaymentReceiptID
	LEFT JOIN FIN.PettyCash pc
		ON pc.PettyCashID = ps.PettyCashID 
WHERE t.Type = 6
	  AND pr.Status <> 2
UNION ALL
SELECT i.PettyCashID,
	   i.Amount,
	   d.Date,
	   i.CurrencyID,
	   d.BranchID,
	   d.FinancialPeriodID,
	   pc.BankAccountID
FROM CFG.DebitCreditNoteItem i
	JOIN FIN.PaymentType t
		ON i.PaymentTypeID = t.PaymentTypeID
	JOIN CFG.DebitCreditNote d
		ON d.DebitCreditNoteID = i.DebitCreditNoteID
	LEFT JOIN FIN.PettyCash pc
		ON pc.PettyCashID = i.PettyCashID 
WHERE t.Type = 6
UNION ALL
SELECT p2.PettyCashID,
	   i.Amount,
	   c.Date,
	   p2.CurrencyID,
	   c.BranchID,
	   c.FinancialPeriodID, 
	   p2.BankAccountID
FROM FIN.PettyCashCostItem i
	LEFT JOIN FIN.PettyCash p2
		ON p2.PettyCashID = i.PettyCashID
	JOIN FIN.PettyCashCost c
		ON i.PettyCashCostID = c.PettyCashCostID
	JOIN FIN.PaymentType t
		ON i.PaymentTypeID = t.PaymentTypeID
WHERE t.Type = 6
UNION ALL
SELECT pc.PettyCashID,
	   -pcci.Amount,
	   pcc.Date,
	   pc.CurrencyID,
	   pcc.BranchID,
	   pcc.FinancialPeriodID,
	   pc.BankAccountID
FROM FIN.PettyCashCostItem pcci
	JOIN FIN.PettyCashCost pcc
		ON pcci.PettyCashCostID = pcc.PettyCashCostID
	JOIN FIN.PettyCash pc
		ON pc.PettyCashID = pcc.PettyCashID
UNION ALL
SELECT rs.PettyCashID,
	   -rs.Amount,
	   rr.Date,
	   rs.CurrencyID,
	   rr.BranchID,
	   rr.FinancialPeriodID,
	   pc.BankAccountID
FROM FIN.ReceiveSubject rs
	JOIN FIN.ReceiveReceipt rr
		ON rs.ReceiveReceiptID = rr.ReceiveReceiptID
	JOIN FIN.ReceiptType r
		ON rs.ReceiptTypeID = r.ReceiptTypeID
	LEFT JOIN FIN.PettyCash pc
		ON pc.PettyCashID = rs.PettyCashID 
WHERE r.Type = 5
UNION ALL
SELECT pc.PettyCashID,
	   pcchi.Amount,
	   pcch.Date,
	   pc.CurrencyID,
	   pcch.BranchID,
	   pcch.FinancialPeriodID,
	   pc.BankAccountID
FROM FIN.PettyCashChargingItem pcchi
	JOIN FIN.PettyCashCharging pcch
		on pcchi.PettyCashChargingID = pcch.PettyCashChargingID
	JOIN FIN.PettyCash pc
		ON pcchi.PettyCashID = pc.PettyCashID;
