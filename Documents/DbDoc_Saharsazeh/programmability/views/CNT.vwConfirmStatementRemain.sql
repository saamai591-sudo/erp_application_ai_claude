
CREATE   VIEW [CNT].vwConfirmStatementRemain
AS 
	SELECT	A.ContractID,
			A.ConfirmStatementID,
			A.PreVoucherID,
			A.ContractStatementNumber,
			A.ContractNumber,
			A.ContractDate,
			A.dlid,
			A.CurrencyID,
			A.PartyID,
			A.Amount,
			A.Net,
			A.Done,
			A.Net + A.Done Remain
FROM  
(
           SELECT 
           cs.ContractID,
                  cs.ConfirmStatementID,
                  cs.Amount,
                  cs.Amount + ISNULL(Addition, 0) - ISNULL(Deduction, 0) Net,
                  ISNULL(cs.PaidAmount, 0) a1,
                  ISNULL(ps.Amount, 0) a2, ISNULL(ca.Amount, 0) a3, ISNULL(dcni.Amount, 0) a4,
                  ISNULL(rs.Amount, 0)     a5,
                  - ISNULL(dcni1.Amount, 0) a6,
                  ISNULL(PaymentRequestItem.Amount, 0) AS a,
                  ISNULL(cs.PaidAmount, 0) - ISNULL(ps.Amount, 0) - ISNULL(ca.Amount, 0) - ISNULL(dcni.Amount, 0) - 
                  ISNULL(rs.Amount, 0) - ISNULL(dcni1.Amount, 0)
                  Done,
                  cs.PreVoucherID,
                  cs1.Number               ContractStatementNumber,
                  CONTRACT.Number          ContractNumber,
                  CONTRACT.Date            ContractDate,
                  CONTRACT.dlid,
                  cs1.CurrencyID,
                  cs1.PartyID
           FROM   CNT.ConfirmStatement cs
                  JOIN cnt.ContractStatement cs1
                       ON  cs.ContractStatementID = cs1.ContractStatementID
                  JOIN cnt.Contract
                       ON  CONTRACT.Contractid = cs.ContractID
                  LEFT JOIN (
                           SELECT ConfirmStatementID,
                                  SUM(Addition -Paid) Addition,
                                  SUM(Deduction -Paid) Deduction
                           FROM   cnt.ConfirmStatementItem
                           GROUP BY
                                  ConfirmStatementID
                       )item
                       ON  item.ConfirmStatementID = cs.ConfirmStatementID
                  LEFT JOIN (
                           SELECT ConfirmStatementID,
                                  SUM(Amount) Amount
                           FROM   fin.PaymentSubject a
                                  JOIN fin.PaymentReceipt b
                                       ON  a.PaymentReceiptID = b.PaymentReceiptID
                           WHERE  ConfirmStatementID IS NOT NULL
                                  AND b.Status <> 2
                           GROUP BY
                                  ConfirmStatementID
                       ) ps
                       ON  ps.ConfirmStatementID = cs.ConfirmStatementID
                  LEFT JOIN (
                           SELECT ConfirmStatementID,
                                  SUM(Amount) Amount
                           FROM   fos.CreditAllocationItem
                           WHERE  ConfirmStatementID IS NOT NULL
                           GROUP BY
                                  ConfirmStatementID
                       ) ca
                       ON  ca.ConfirmStatementID = cs.ConfirmStatementID
                  LEFT JOIN (
                           SELECT ConfirmStatementID,
                                  SUM(Amount) Amount
                           FROM   CFG.DebitCreditNoteItem
                           WHERE  ConfirmStatementID is NOT null
                                  AND [Type] = 0
                           GROUP BY
                                  ConfirmStatementID
                       ) dcni
                       ON  cs.ConfirmStatementID = dcni.ConfirmStatementID
                  LEFT JOIN (
                           SELECT ConfirmStatementID,
                                  SUM(Amount) Amount
                           FROM   FIN.ReceiveSubject
                           WHERE  ConfirmStatementID is NOT null
                           GROUP BY
                                  ConfirmStatementID
                       ) rs
                       ON  cs.ConfirmStatementID = rs.ConfirmStatementID
                  LEFT JOIN (
                           SELECT ConfirmStatementID,
                                  SUM(Amount) Amount
                           FROM   CFG.DebitCreditNoteItem
                           WHERE  ConfirmStatementID is NOT null
                                  AND [Type] = 1
                           GROUP BY
                                  ConfirmStatementID
                       ) dcni1
                       ON  cs.ConfirmStatementID = dcni1.ConfirmStatementID
                  LEFT JOIN (
                           SELECT pri.BaseDocumentID AS ConfirmStatementID,
                                  SUM(pri.Amount) AS Amount
                           FROM   req.PaymentRequestItem pri
                           join req.PaymentRequest AS pr2 on pr2.PaymentRequestID = pri.PaymentRequestID
                                  LEFT JOIN req.PaymentOrderItem poi
                                       ON  poi.PaymentRequestItemID = pri.PaymentRequestItemID
                                  LEFT JOIN FIN.PaymentReceipt pr
                                       ON  pr.PaymentOrderID = poi.PaymentOrderID
                           WHERE  pri.BaseDocumentType = 4
                           AND pr2.[Status] NOT IN (3,5)
                                  AND (
                                          poi.PaymentRequestItemID IS NULL
                                          OR pr.PaymentOrderID IS NULL
                                  )
                                   
                           GROUP BY
                                  pri.BaseDocumentID
                       )                AS PaymentRequestItem
                       ON  cs.ConfirmStatementID = PaymentRequestItem.ConfirmStatementID
       )A


