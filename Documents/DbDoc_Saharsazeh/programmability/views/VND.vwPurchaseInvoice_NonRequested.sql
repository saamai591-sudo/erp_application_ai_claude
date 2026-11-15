CREATE   VIEW VND.vwPurchaseInvoice_NonRequested
AS 
SELECT i.PurchaseInvoiceID,
                  i.TotalNetPrice Net,
				  ISNULL(pri.Amount, 0) Done,
                  i.TotalNetPrice
				  - ISNULL(pipp.Price, 0)
				  - ISNULL(pri.Amount, 0)
				  NonRequested 
           FROM VND.PurchaseInvoice i
				left join (select i.BaseDocumentID,sum(i.Amount) Amount 
						from REQ.PaymentRequestItem i	
						join REQ.PaymentRequest h on i.PaymentRequestID = h.PaymentRequestID
						where i.BaseDocumentType = 2 and i.BaseDocumentID is not null
						and h.Status not in  (3,5)
						group by i.BaseDocumentID					
					) pri on i.PurchaseInvoiceID = pri.BaseDocumentID
				LEFT JOIN (
				    SELECT 
				        PurchaseInvoiceID,
				        SUM(Price) AS Price
				    FROM VND.PurchaseInvoicePrePayment
				    GROUP BY PurchaseInvoiceID
				) pipp
				    ON i.PurchaseInvoiceID = pipp.PurchaseInvoiceID;
