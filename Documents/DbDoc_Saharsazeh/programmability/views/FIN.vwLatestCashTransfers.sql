

CREATE   view [FIN].[vwLatestCashTransfers]
--with encryption
as
	
	--Type 1 چک های ارسال شده
	--Type 2 چک های تحویل گرفته شده
	select a.CashTransferItemID,
	       a.ReceivedCheqeID,
		   a.Date,
		   a.SourceCashID,
		   a.TargetCashID,
		   a.Type
    from 
	(
	select *
	from (select ROW_NUMBER() OVER(PARTITION BY i.ReceivedCheqeID ORDER BY i.CashTransferItemID desc) rno,
		            i.CashTransferItemID,
					i.ReceivedCheqeID,
					c.[Date],
					c.SourceCashID,
					c.TargetCashID,
					c.Type
			from FIN.CashTransferItem i
			join FIN.CashTransfer c on i.CashTransferID = c.CashTransferID			 
			where c.Type = 1
			) T
	where T.rno = 1

	union 

	select *
	from (select ROW_NUMBER() OVER(PARTITION BY i.ReceivedCheqeID ORDER BY i.CashTransferItemID desc) rno,
		            i.CashTransferItemID,
					i.ReceivedCheqeID,
					c.[Date],
					c.SourceCashID,
					c.TargetCashID,
					c.Type
			from FIN.CashTransferItem i
			join FIN.CashTransfer c on i.CashTransferID = c.CashTransferID			 
			where c.Type = 2
			) T
	where T.rno = 1
	) as a
