
CREATE   proc [VND].[GetDocumentVerificationBaseDocuments]
@Type Tinyint
as

	DECLARE @UserID                  INT,
	        @DateType                TINYINT,
	        @DateFormat              VARCHAR(10),
	        @Culture                 VARCHAR(10)

	SET @UserID = cfg.GetuserID()
	SET @Culture = CFG.GetuserCulture();


	SELECT @DateType = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID;
	
	IF @DateType IS NULL
	    SET @DateType = CASE @Culture
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END;
	
SELECT @DateFormat = us.SettingValue
FROM   CFG.UserSetting us
WHERE  us.SettingKey = 'Date_Format'
       AND us.UserID = @UserID;

IF @DateFormat IS NULL
    SET @DateFormat = 'YY/MM/DD';

if @Type  = 1
begin

	select *		
	from
	(
		select 
			[TenderRequestID] BaseID,
			tr.Number BaseDocumentNumber,
			CFG.GetCLRSaturnDate(tr.[Date], @DateFormat, 0, @DateType) AS Date_BaseDocumentDate,
			dvpi.DocumentVerificationPathItemID,
			dvpi.Title DocumentVerificationPathItem,
			ROW_NUMBER() over(partition by [TenderRequestID] order by RowIndex) RowNumber
		from [REQ].[TenderRequest] tr
		join vnd.DocumentVerificationPathItem dvpi
			on tr.DocumentVerificationPathID = dvpi.DocumentVerificationPathID
		where tr.State = 2
		  and DocumentVerificationPathItemID not in
		  (		
		   select DocumentVerificationPathItemID
			from [VND].[DocumentVerification]
			where BaseType = 1
			and   BaseID = tr.TenderRequestID
		  )
	)res
	where res.RowNumber = 1

end

if @Type  = 2
begin

select *		
	from
	(
		select 
			[EnactmentID] BaseID,
			t.Number BaseDocumentNumber,
			CFG.GetCLRSaturnDate(t.[Date], @DateFormat, 0, @DateType) AS Date_BaseDocumentDate,
			dvpi.DocumentVerificationPathItemID,
			dvpi.Title DocumentVerificationPathItem,
			ROW_NUMBER() over(partition by t.[TenderRequestID] order by RowIndex) RowNumber
		from VND.Enactment e
		join vnd.Tender t on e.TenderID = t.TenderID
		join vnd.DocumentVerificationPathItem dvpi
			on e.DocumentVerificationPathID = dvpi.DocumentVerificationPathID
		where e.State = 2
		  and DocumentVerificationPathItemID not in
		  (		
		   select DocumentVerificationPathItemID
			from [VND].[DocumentVerification]
			where BaseType = 2
			and   BaseID = e.EnactmentID
		  )
	)res
	where RowNumber = 1

end
