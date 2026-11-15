

CREATE   VIEW [CFG].[Cash_LastAmount]
AS 

SELECT T.CashID,T.CurrencyID,(T.FirstAmount + T.Receives) - T.Payments AS LastAmount
FROM(
		SELECT c.CashID,cb.CurrencyID,cb.FirstAmount,
		       ISNULL(rc.Amount,0) + ISNULL(rcfi.Amount,0) + ISNULL(ps.Amount,0) +
			   isnull(pri.Amount,0) Receives,
			   ISNULL(pc.Amount,0) + isnull(pri2.Amount,0) Payments
		FROM CFG.CashBalance cb
		join CFG.Cash c on cb.CashID = c.CashID

		
		LEFT JOIN (select CashID,CurrencyID,sum(Amount) Amount from FIN.ReceivedCash
		        group by CashID,CurrencyID) rc on c.CashID = rc.CashID and cb.CurrencyID = rc.CurrencyID

		LEFT JOIN (select f.CashID,c.CurrencyID,sum(c.Amount) Amount from FIN.ReceiptCheqeFlowItem i
		        join FIN.ReceiptCheqeFlow f on i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
				join FIN.ReceivedCheqe c on i.ReceivedCheqeID = c.ReceivedCheqeID
				where f.[Type] = 3 and i.[State] = 3 group by f.CashID,c.CurrencyID) rcfi on c.CashID = rcfi.CashID and cb.CurrencyID = rcfi.CurrencyID

		LEFT JOIN (select DLID,CurrencyID,sum(Amount) Amount from FIN.PaymentSubject s
		        join FIN.PaymentType t on s.PaymentTypeID = t.PaymentTypeID
				where t.Type = 5 group by DLID,CurrencyID) ps on c.DlID = ps.DLID and cb.CurrencyID = ps.CurrencyID
				
		LEFT JOIN (select CashID,CurrencyID,sum(Amount) Amount from FIN.PaymentCash
				group by CashID,CurrencyID) pc on c.CashID = pc.CashID and cb.CurrencyID = pc.CurrencyID 

		left join (select i.CashID,sum(i.Amount) Amount from POS.PosReceiptItem i
	           join POS.PosReceipt r on i.PosReceiptID = r.PosReceiptID
			   where r.IsPayed = 0 
			   group by i.CashID) pri on c.CashID = pri.CashID and cb.CurrencyID = -1

	    left join (select i.CashID,sum(-i.Amount) Amount from POS.PosReceiptItem i
	           join POS.PosReceipt r on i.PosReceiptID = r.PosReceiptID
			   where r.IsPayed = 1
			   group by i.CashID) pri2 on c.CashID = pri2.CashID and cb.CurrencyID = -1
	)T

