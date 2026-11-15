
CREATE VIEW [CFG].[vwInstallmentPayment]
AS 

SELECT *
FROM   (
		   SELECT InstallmentPaymentItemID,
                  Amount - Discount Amount,
                  pr.[Date]
           FROM   fin.PaymentSubject
                  INNER JOIN FIN.PaymentReceipt AS pr
                       ON  pr.PaymentReceiptID = fin.PaymentSubject.PaymentReceiptID
          
           UNION

           SELECT InstallmentPaymentItemID,
                  s.Amount - s.Discount Amount,
                  case when rc.date is not null then rc.date else rr.[Date] end [Date]
           FROM   fin.ReceiveSubject s
                  INNER JOIN FIN.ReceiveReceipt AS rr
                       ON  rr.ReceiveReceiptID = s.ReceiveReceiptID
				  left join fin.ReceivedCheqe rc
						on rc.ReceivedCheqeID = s.ReceivedCheqeID

           UNION

           SELECT InstallmentPaymentItemID,
                  Amount,
                  [Date]
           FROM   cfg.ManualReceipt

		   UNION 

		   select i.InstallmentPaymentItemID,
		          i.Amount,
				  p.[Date]
		   from FIN.PettyCashCostItem i
		   join FIN.PettyCashCost p on i.PettyCashCostID = p.PettyCashCostID

		   UNION

		   select InstallmentPaymentItemID,
				  Amount - Discount as Amount,
		          dc.[Date]
		   from CFG.DebitCreditNoteItem i
		   join CFG.DebitCreditNote dc on i.DebitCreditNoteID = dc.DebitCreditNoteID
       )T
WHERE  T.InstallmentPaymentItemID IS NOT NULL



