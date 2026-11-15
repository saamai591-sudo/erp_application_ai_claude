
------------------------------------------------
Create   VIEW [FIN].ReceiveSubject_PriceRemains
--WITH ENCRYPTION
AS

select *, T.Amount - T.DoPrice as NonPrice
from (
		select s.ReceiveSubjectID,
			   s.Amount - s.Discount as Amount,
			   isnull(ipr.Price, 0) + isnull(dcni.Amount, 0) + isnull(cspp.Amount, 0) as DoPrice
		from FIN.ReceiveSubject s 
		left join fin.ReceivedCheqe rs
			on s.ReceivedCheqeID = rs.ReceivedCheqeID
		left join 
				   (
				   select ReceiveSubjectID,SUM(Price) as Price
				   from SLE.InvoicePreReceive irp
				   JOIN sle.Invoice AS i ON i.InvoiceID = irp.InvoiceID
		           WHERE i.SaleInvoiceStatus <> 5
				   group by ReceiveSubjectID
				   ) ipr on s.ReceiveSubjectID = ipr.ReceiveSubjectID
		left join 
				   (
				   select ReceiveSubjectID,SUM(Amount - Discount) as Amount
				   from CFG.DebitCreditNoteItem
				   where ReceiveSubjectID is not null
				   group by ReceiveSubjectID
				   ) dcni on s.ReceiveSubjectID = dcni.ReceiveSubjectID
		left join 
				   (
				   select ReceiveSubjectID, sum(Price) as Amount
				   from cnt.ConfirmStatementPrePayment
				   where ReceiveSubjectID is not null
				   group by ReceiveSubjectID
				   ) cspp on s.ReceiveSubjectID = cspp.ReceiveSubjectID
		where (rs.ReceivedCheqeID is null or rs.LastState <> 2)
	) T


