

CREATE   view [FIN].[vwLatestCashTransfersStatus]
--with encryption
as
	
	--وضعیت 1 برای چک های در راه مانده. یعنی چک هایی که در آخرین گردش ارسال شده اند و هنوز تحویل به صندوق مقصد برای آنها صادر نشده.
	--وضعیت 2 برای چک هایی که در آخرین گردش تحویل به مقصد شده اند و پس از آن ارسال دیگری برای آنها ثبت نشده	 
	select * from (
	select a.CashTransferItemID,
	       a.ReceivedCheqeID,
	       a.Date,
		   a.SourceCashID,
		   a.TargetCashID,
		   case when a.Type = 1 and not exists (
		                                        select * from FIN.vwLatestCashTransfers t
												where t.Type = 2 and 
												t.ReceivedCheqeID = a.ReceivedCheqeID and 
												t.Date >= a.Date and
												t.CashTransferItemID > a.CashTransferItemID
		                                       ) then 1
				when a.Type = 2 and not exists (
				                                select * from FIN.vwLatestCashTransfers t2
												where t2.Type = 1 and 
												t2.ReceivedCheqeID = a.ReceivedCheqeID and 
												t2.Date >= a.Date and
												t2.CashTransferItemID > a.CashTransferItemID
				                               ) then 2

		   end as Status
    from FIN.vwLatestCashTransfers a) as T
	where Status is not null and (Status = 1 or Status = 2)

	

