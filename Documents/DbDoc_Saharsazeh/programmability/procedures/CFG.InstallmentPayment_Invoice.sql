
CREATE proc [CFG].[InstallmentPayment_Invoice]

--with encryption

as

DECLARE	@Culture varchar(10),
		@userid int,
		@DateType TINYINT,
		@DateFormat VARCHAR(10)

 set  @userid = cfg.GetuserID()

set @Culture = cfg.GetuserCulture()

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
		   AND us.UserID = @UserID
	IF @DateType IS NULL
	SET @DateType = CASE @Culture WHEN 'fa' THEN 0	
											  WHEN 'en' THEN 1
											  WHEN 'ar' THEN 2 END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
		   AND us.UserID =  @UserID
	       
	IF @DateFormat IS NULL

	SET @DATEFORMAT = 'YY/MM/DD'

	select
			I.InstallmentPaymentItemID,
			SUM(ISNULL(
			DATEDIFF(day,i.date,
								case when rs.ReceivedCashID is not null then rr.Date
									 when rs.ReceivedCheqeID is not null then rq.Date
									 when rs.ReceivedBankDraftID is not null then rb.Date
									 else null end
					)
				  ,0)
			*rs.Amount) AS RRatio,
			SUM(rs.Amount) AS SumRSAmount
			into #RRatio
	from cfg.InstallmentPaymentItem I 
	join fin.ReceiveSubject rs on rs.InstallmentPaymentItemID = I.InstallmentPaymentItemID
	join fin.ReceiveReceipt rr on rr.ReceiveReceiptID = rs.ReceiveReceiptID
	left join fin.ReceivedCash rc on rs.ReceivedCashID = rc.ReceivedCashID
	left join fin.ReceivedCheqe rq on rs.ReceivedCheqeID = rq.ReceivedCheqeID
	left join fin.ReceivedBankDraft rb on rs.ReceivedBankDraftID = rb.ReceivedBankDraftID
	group by I.InstallmentPaymentItemID



Select 
	I.InstallmentPaymentItemID,
	v.Number,
	CFG.GetCLRSaturnDate(v.[Date], @DateFormat  , 0, @DateType) as InvoiceDate,
	p.Title+' '+isnull(p.LastName,'') PartyName,
	d.Code PartyCode,
	v.TotalNetPrice,
	I.Number InstallmentNumber,
	CFG.GetCLRSaturnDate(I.[Date], @DateFormat  , 0, @DateType) as InstallmentDate,
	I.Amount,
	round((isnull(r.RRatio,0) + (case when I.date > getdate() then 0
								else DATEDIFF(DAY,I.date,getdate()) end
								*
						  (I.Amount - isnull(r.SumRSAmount,0))))/I.Amount,0) Ratio,
	g.Title CustomerGroup
	
 from cfg.InstallmentPayment H
join cfg.InstallmentPaymentItem I on I.InstallmentPaymentID = H.InstallmentPaymentID
left join #RRatio r on r.InstallmentPaymentItemID = I.InstallmentPaymentItemID
join sle.Invoice V on v.InvoiceID = H.DocumentID
join cfg.Party p on p.PartyID = v.CustomerID
left join acc.dl d on d.DLID = p.DlID
left join cfg.[Group] g on g.GroupID = p.CustomerGroupID
where DocumentName = 'SLE.Invoice'
