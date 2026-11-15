CREATE   VIEW [REQ].[vwPayemntRequest_NonPaymented]
AS 
SELECT a.PaymentRequestID,a.CurrencyID,a.Amount,ISNULL(paid.Amount,0) done,a.Amount-ISNULL(paid.Amount,0) AS non
  FROM (
SELECT pri.PaymentRequestID,
       pri.CurrencyID,
       SUM(pri.Amount)  Amount
FROM   req.PaymentRequestItem  AS pri
GROUP BY
       pri.PaymentRequestID,pri.CurrencyID) a
       
LEFT JOIN (    
SELECT pr.PaymentRequestID,ps.CurrencyID,SUM(ps.Amount) Amount
  FROM fin.PaymentSubject AS ps
JOIN fin.PaymentReceipt AS pr ON pr.PaymentReceiptID = ps.PaymentReceiptID
WHERE pr.PaymentRequestID IS NOT NULL
GROUP BY pr.PaymentRequestID,ps.CurrencyID) paid
ON a.PaymentRequestID=paid.PaymentRequestID and a.CurrencyID=paid.CurrencyID