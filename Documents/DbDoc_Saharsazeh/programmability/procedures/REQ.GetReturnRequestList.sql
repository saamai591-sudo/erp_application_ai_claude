
------------------------------------------------------------------
CREATE     PROCEDURE [REQ].GetReturnRequestList
(
    @FinancialPeriodId INT ,
    @PageNumber INT ,
    @RowspPage INT ,
    @Sort NVARCHAR(MAX) = NULL ,
    @Filter NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @dateFormat VARCHAR(10) ,
            @dateType TINYINT = 0 ,
            @WithOutbase NVARCHAR(100) ,
            @StockReceipt NVARCHAR(100) ,
            @TemporaryStockReceipt NVARCHAR(100) ,
            @Culture VARCHAR(10) ,
            @userId INT,
			@CultureNo tinyint

	SET @UserID = cfg.GetuserID()
	SET @Culture = cfg.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture


        SELECT @dateType = us.SettingValue
        FROM   CFG.UserSetting us
        WHERE  us.SettingKey = 'Date_Type'
               AND us.UserID = @userId;

        IF @dateType IS NULL
            SET @dateType = CASE @Culture
                                 WHEN 'fa' THEN 0
                                 WHEN 'en' THEN 1
                                 WHEN 'ar' THEN 2
                            END;

        SELECT @dateFormat = us.SettingValue
        FROM   CFG.UserSetting us
        WHERE  us.SettingKey = 'Date_Format'
               AND us.UserID = @userId;

        IF @dateFormat IS NULL
            SET @dateFormat = 'YY/MM/DD';

        SELECT @WithOutbase = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'RequestDocumentBase'
               AND L.Item = 'WithOutbase'
               AND LV.Culture = @Culture;

        SELECT @StockReceipt = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'RequestDocumentBase'
               AND L.Item = 'StockReceipt'
               AND LV.Culture = @Culture;

        SELECT @TemporaryStockReceipt = LV.Value
        FROM   CFG.LocalizeEnum L
               JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
        WHERE  L.Enum = 'RequestDocumentBase'
               AND L.Item = 'TemporaryStockReceipt'
               AND LV.Culture = @Culture;

   DECLARE @Submit NVARCHAR(100),
		@Confirmed NVARCHAR(100),
		@Rejected NVARCHAR(100),
		@Ended NVARCHAR(100)

	SELECT @Submit = i.[Value] FROM CFG.LocalizeEnum l
	JOIN  CFG.LocalizeEnumValue i on l.LocalizeEnumID = i.LocalizeEnumID
	WHERE l.Enum = 'RequestStates' 
			AND Item = 'Submitted'
            AND i.Culture = @Culture;

	SELECT @Confirmed = i.[Value] FROM CFG.LocalizeEnum l
	JOIN  CFG.LocalizeEnumValue i on l.LocalizeEnumID = i.LocalizeEnumID
	WHERE l.Enum = 'RequestStates' 
			AND Item = 'Confirmed'
            AND i.Culture = @Culture;
			
	SELECT @Rejected = i.[Value] FROM CFG.LocalizeEnum l
	JOIN  CFG.LocalizeEnumValue i on l.LocalizeEnumID = i.LocalizeEnumID
	WHERE l.Enum = 'RequestStates' 
			AND Item = 'Rejected'
            AND i.Culture = @Culture;

	SELECT @Ended = i.[Value] FROM CFG.LocalizeEnum l
	JOIN  CFG.LocalizeEnumValue i on l.LocalizeEnumID = i.LocalizeEnumID
	WHERE l.Enum = 'RequestStates' 
			AND Item = 'Ended'
            AND i.Culture = @Culture;

    IF @Sort IS NULL
        OR @Sort = ''
        SET @Sort = 'ReturnRequestDate ';

        DECLARE @Query NVARCHAR(MAX);
        SET @Query = N'
 		WITH Query_Result 
		(
			ReturnRequestID ,
			BranchID ,
			StockID ,
			ReturnRequestNumber ,
			ReturnRequestDate ,
			ReturnRequestState ,
			StateString,
			ReturnRequester ,
			Creator ,
			CreationDate ,
			LastEditor ,
			LastEditionDate ,
			Version ,
			FinancialPeriodID ,
			OrganizationUnitID ,
			DocumentType ,
			DocumentTypeString ,
			BranchCode ,
			BranchTitle ,
			StockCode ,
			StockTitle ,
			Date_ReturnRequestDate ,
			CreateDateString ,
			EditionDateString ,
			CreatorUserName ,
			EditorName,
			LastUpdateDateRelatedToState,
			EditorNameRelatedToState,
            ReviewerName,
            Reviewer,
            ReviewDate,
            Date_ReviewDate
		)
		as
		(
			SELECT  rq.ReturnRequestID ,
					rq.BranchID ,
					rq.StockID ,
					rq.ReturnRequestNumber ,
					rq.ReturnRequestDate ,
					rq.ReturnRequestState ,
					CASE  rq.ReturnRequestState
						WHEN 1 THEN @Submit
						WHEN 2 THEN @Confirmed
						WHEN 3 THEN @Rejected
						WHEN 4 THEN @Ended
						END AS StateString,
					case when @CultureNo = 1 then ou.Title else ou.Title2 end ReturnRequester ,
					rq.Creator ,
					rq.CreationDate ,
					rq.LastEditor ,
					rq.LastEditionDate ,
					rq.Version ,
					rq.FinancialPeriodID ,
					rq.OrganizationUnitID ,
					rq.DocumentType ,
					CASE rq.DocumentType
					  WHEN 1 THEN @WithOutbase
					  WHEN 3 THEN @StockReceipt
					  WHEN 4 THEN @TemporaryStockReceipt
					END DocumentTypeString ,
					b.Code BranchCode ,
					case when @CultureNo = 1 then b.Title else b.Title2 end  BranchTitle ,
					s.Code StockCode ,
					case when @CultureNo = 1 then s.Title else s.Title2 end  StockTitle ,
					CFG.GetCLRSaturnDate(rq.ReturnRequestDate, @dateFormat, 0, @dateType) Date_ReturnRequestDate,
					CFG.GetCLRSaturnDate(rq.CreationDate, @dateFormat, 1, @dateType) CreateDateString ,
					CFG.GetCLRSaturnDate(rq.LastEditionDate, @dateFormat, 1, @dateType) EditionDateString ,
					u.Name CreatorUserName ,
					u2.Name EditorName,
					case when rq.ReturnRequestState = 2 or rq.ReturnRequestState = 3 
					then CFG.GetCLRSaturnDate(rq.LastEditionDate, @dateFormat, 1, @dateType)
					else '''' end as  LastUpdateDateRelatedToState ,
					case when rq.ReturnRequestState = 2 or rq.ReturnRequestState = 3 
					then u2.Name
					else '''' end as EditorNameRelatedToState,
					u3.Name ReviewerName,
                    rq.Reviewer,
                    rq.ReviewDate,
                    CFG.GetCLRSaturnDate(rq.ReviewDate, @DateFormat, 1, @DateType) Date_ReviewDate
			FROM    REQ.ReturnRequest rq
			        LEFT JOIN CFG.[User] u3 
                        on u3.UserID=rq.Reviewer
					JOIN CFG.OrganizationUnit ou ON ou.OrganizationUnitID = rq.OrganizationUnitID
					JOIN CFG.Branch b ON b.BranchID = rq.BranchID
					JOIN STF.Stock s ON s.StockID = rq.StockID
					JOIN CFG.[User] u ON u.UserID = rq.Creator
					JOIN CFG.[User] u2 ON u2.UserID = rq.LastEditor
	INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = rq.BranchID
	INNER JOIN cfg.vwOrganizationUnitAccess AS voua ON voua.OrganizationUnitID = rq.OrganizationUnitID
	INNER JOIN cfg.vwStockAccess AS vsa ON vsa.StockID = rq.StockID
	where     rq.FinancialPeriodID = @FinancialPeriodID
					
		)
	'   ;

        PRINT @Query;
        DECLARE @selectQuery NVARCHAR(MAX);

        IF @Filter IS NULL
           OR @Filter = ''
            SET @Filter = '';
        ELSE
            SET @Filter = 'Where (' + @Filter + ')';

        DECLARE @tableName VARCHAR(100);
        SET @tableName = CFG.getTempTableName(1);

        SET @Query = CFG.ApplyPaging(
                         @tableName ,
                         @Query ,
                         @PageNumber ,
                         @RowspPage ,
                         @Filter ,
                         @Sort);
        --PRINT @Query
        EXECUTE sp_executesql @Query ,
                              N'
								@FinancialPeriodId INT,
								@WithOutbase NVARCHAR(100),
								@StockReceipt NVARCHAR(100),
								@TemporaryStockReceipt NVARCHAR(100),
								@dateFormat VARCHAR(10),
								@dateType TINYINT,
								@userId  INT,
								@CultureNo TINYINT,
								@Submit NVARCHAR(100),
								@Confirmed NVARCHAR(100),
								@Rejected NVARCHAR(100),
								@Ended NVARCHAR(100)
							' ,
                              @FinancialPeriodId = @FinancialPeriodId ,
                              @WithOutbase = @WithOutbase ,
                              @StockReceipt = @StockReceipt ,
                              @TemporaryStockReceipt = @TemporaryStockReceipt ,
                              @dateFormat = @dateFormat ,
                              @dateType = @dateType ,
                              @userId = @userId,
							  @CultureNo  = @CultureNo ,
							  @Submit	=@Submit,
							  @Confirmed=@Confirmed,
							  @Rejected	=@Rejected,
							  @Ended	=@Ended

        DECLARE @Count INT;

        EXEC ( 'SELECT * FROM ' + @tableName + ' ORDER BY _RN' );

        SET @Query = 'select top 1 @Count=  r_count from ' + @tableName;

        EXECUTE sp_executesql @Query ,
                              N'@count int out' ,
                              @Count = @Count OUT;

        RETURN ISNULL(@Count, 0);
    END;
