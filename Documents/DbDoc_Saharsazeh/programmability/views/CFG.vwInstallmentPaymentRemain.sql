CREATE     VIEW [CFG].[vwInstallmentPaymentRemain]
AS 

SELECT ipi.InstallmentPaymentItemID,
       ipi.Amount,
        CAST(ISNULL(T.amount,0)  AS DECIMAL(36, 10)) AS PaidAmount , CAST( ipi.Amount-ISNULL(T.amount,0) AS DECIMAL(36, 10)) AS remain
FROM   cfg.InstallmentPaymentItem AS ipi
       LEFT JOIN (
                SELECT T0.InstallmentPaymentItemID,
                       SUM(amount)  AS amount
                FROM   (
                           SELECT InstallmentPaymentItemID,
                                  Amount - Discount Amount,
                                  pr.[Date]
                           FROM   fin.PaymentSubject
                                  INNER JOIN FIN.PaymentReceipt AS pr
                                       ON  pr.PaymentReceiptID = fin.PaymentSubject.PaymentReceiptID
							where pr.Status <> 2

                           UNION ALL

                           SELECT InstallmentPaymentItemID,
                                  s.Amount - s.Discount Amount,
                                  case when rc.date is not null then rc.date else rr.[Date] end [Date]
                           FROM   fin.ReceiveSubject s
                                  INNER JOIN FIN.ReceiveReceipt AS rr
                                       ON  rr.ReceiveReceiptID = s.ReceiveReceiptID
								  left join fin.ReceivedCheqe rc
									on rc.ReceivedCheqeID = s.ReceivedCheqeID

                           UNION ALL 

                           SELECT InstallmentPaymentItemID,
                                  Amount,
                                  [Date]
                           FROM   cfg.ManualReceipt

						   UNION ALL

						   SELECT InstallmentPaymentItemID,
                                  Amount,
                                  p.[Date]
                           FROM   fin.PettyCashCostItem i
                                  INNER JOIN FIN.PettyCashCost p
                                       ON  i.PettyCashCostID = p.PettyCashCostID

							UNION ALL

							select InstallmentPaymentItemID,
							       Amount - Discount as Amount,
								   dc.[Date]
							from CFG.DebitCreditNoteItem i
							join CFG.DebitCreditNote dc on i.DebitCreditNoteID = dc.DebitCreditNoteID
                       ) T0
                GROUP BY
                       T0.InstallmentPaymentItemID
            )T
            ON  t.InstallmentPaymentItemID = ipi.InstallmentPaymentItemID
