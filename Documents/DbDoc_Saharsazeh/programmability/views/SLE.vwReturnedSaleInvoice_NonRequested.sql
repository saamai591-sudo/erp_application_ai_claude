
CREATE    VIEW SLE.vwReturnedSaleInvoice_NonRequested
AS 

SELECT i.ReturnedSaleInvoiceID,
                  i.TotalNetPrice - ISNULL(pri.Amount, 0) AS NonRequested
           FROM   SLE.ReturnedSaleInvoice i

				left join (select i.BaseDocumentID,sum(i.Amount) Amount 
						from REQ.PaymentRequestItem i	
						join REQ.PaymentRequest h on i.PaymentRequestID = h.PaymentRequestID 
						where i.BaseDocumentType = 3 and i.BaseDocumentID is not null
						and h.Status not in (3,5)
						group by i.BaseDocumentID					
					) pri on i.ReturnedSaleInvoiceID = pri.BaseDocumentID

