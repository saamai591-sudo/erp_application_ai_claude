
CREATE     PROCEDURE [NOC].GetModificationList
(
    @PageNumber            INT,
    @RowspPage             INT,
    @Sort                  NVARCHAR(MAX) = NULL,
    @Filter                NVARCHAR(MAX) = NULL
)
AS
BEGIN
	DECLARE @UserID                  INT,
	        @DateType                TINYINT,
	        @ViewRelatedToUser       INT,
	        @ViewRelatedToOthers     NVARCHAR(MAX),
	        @DateFormat              VARCHAR(10),
			@CultureInfo  VARCHAR(10),
			@CultureNo VARCHAR(10),
			@Voucher NVARCHAR(50),
			@PreVoucher NVARCHAR(50),
			@Submit NVARCHAR(50),
            @UnauthorizedUsers NVARCHAR(MAX);
	
	SET @UserID = cfg.GetuserID()
	set @CultureInfo = cfg.GetuserCulture()

	select @CultureNo = CultureNo 
	from cfg.CultureInfo
	where Culture = @CultureInfo

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE @CultureInfo
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
	    SET @DATEFORMAT = 'YY/MM/DD'  
	
	SELECT @ViewRelatedToUser = UserID
	FROM   cfg.vwOperationLevelAccess
	WHERE  EntityName = 'Modification'
			AND AccessKey = 'ViewRelatedToUser'
			AND UserID = @UserID
	
	SELECT @ViewRelatedToOthers = UserID ,
           @UnauthorizedUsers = Users
	FROM   cfg.vwOperationLevelAccess
	WHERE  EntityName = 'Modification'
			AND AccessKey = 'ViewRelatedToOthers'
			AND UserID = @UserID
	
	IF @Sort IS NULL
	   OR @Sort = ''
	    SET @Sort = 'Number '
	
    SELECT  @Submit = LV.Value
    FROM    CFG.LocalizeEnum L
            JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE   L.Enum = 'Statuses'
            AND L.Item = 'Submit'
            AND LV.Culture = @CultureInfo;

    SELECT  @Voucher = LV.Value
    FROM    CFG.LocalizeEnum L
            JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE   L.Enum = 'PreVoucherStatuses'
            AND L.Item = 'Voucher'
            AND LV.Culture = @CultureInfo;
	
    SELECT  @PreVoucher = LV.Value
    FROM    CFG.LocalizeEnum L
            JOIN CFG.LocalizeEnumValue LV ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE   L.Enum = 'PreVoucherStatuses'
            AND L.Item = 'PreVoucher'
            AND LV.Culture = @CultureInfo;

	SET @Sort=REPLACE(@Sort,'CreateDateString','[CreationDate]')
	SET @Sort=REPLACE(@Sort,'EditionDateString','[LastEditionDate]')
	SET @Sort=REPLACE(@Sort,'DateString','[Date]')

	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = N'WITH Query_Result 
					As (
							SELECT		   v.ModificationID, 
										   v.Number, 
										   v.Date, 
										   v.ReportagePeriodID,
										   case when '+@CultureNo+' = 1 then b.Title else b.Title2 end ReportagePeriodTitle , 
										   case when '+@CultureNo+' = 1 then v.[Description] else v.Description2 end Description , 
										   v.SlID,
										   case when '+@CultureNo+' = 1 then sl.Title else sl.Title2 end SlTitle , 
										   acc.SlFullCode(v.slid) SlCode,
										   v.VoucherItemID,
										   v2.ReferenceNumber InternalReferenceNumber,
										   v.PreVoucherID,
										   vo.ReferenceNumber VoucherNumber, 
										   CFG.GetCLRSaturnDate(vo.[Date],@DateFormat  , 0,@DateType)AS VoucherDate,
										   v.Creator, 
										   v.CreationDate, 
										   v.LastEditionDate,
										   v.[Version],
										   CFG.GetCLRSaturnDate(v.[Date],@DateFormat  , 0,@DateType)AS DateString,
										   CFG.GetCLRSaturnDate(v.CreationDate,@DateFormat  , 1,@DateType) AS CreateDateString, 
										   CFG.GetCLRSaturnDate(v.LastEditionDate,@DateFormat , 1,@DateType) AS EditionDateString, 
										   u.Name AS CreatorUserName, 
										   u2.Name AS EditorName,
											CASE 
												WHEN vo.VoucherID IS NOT NULL THEN '''+@Voucher+'''
												WHEN v.PreVoucherID IS NOT NULL THEN '''+@PreVoucher+'''
												ELSE '''+@Submit+'''
											END  StatusString,
											vo.VoucherID 
	           
									FROM noc.Modification v
										join noc.ReportagePeriod b on v.ReportagePeriodID = b.ReportagePeriodID
										join acc.SL on sl.SlID = v.SlID
										join acc.VoucherItem vi on vi.VoucherItemID = v.VoucherItemID
										join acc.Voucher v2 on v2.VoucherID = vi.VoucherID
										JOIN CFG.[User] AS u ON u.UserID = v.Creator 
										JOIN CFG.[User] AS u2 ON u2.UserID = v.LastEditor
										LEFT JOIN (
												SELECT PrevoucherID,
														VoucherID
												FROM   acc.VoucherPrevoucher
												GROUP BY
														PrevoucherID,
														VoucherID
											)vp
											ON  vp.PrevoucherID = v.PreVoucherID
										LEFT JOIN acc.voucher vo ON  vo.VoucherID = vp.VoucherID
									WHERE  (@UserID = -1 
										or (@ViewRelatedToUser is not null and v.Creator = @UserID)
										or (@ViewRelatedToOthers IS NOT NULL AND v.Creator not in (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
										)
									)	
			) '
	
	
	DECLARE @selectQuery NVARCHAR(MAX)
	
	IF @Filter IS NULL
	   OR @Filter = ''
	    SET @Filter = ''
	ELSE
	    SET @Filter = 'Where (' + @Filter + ')'
	
	
	DECLARE @tableName VARCHAR(100)
	SET @tableName = cfg.getTempTableName(1)
	
	
	
	SET @Query = Cfg.ApplyPaging (
	        @tableName,
	        @Query,
	        @PageNumber,
	        @RowspPage,
	        @Filter,
	        @Sort
	    )
	PRINT @Query
	
	EXECUTE sp_executesql @Query,
	     N'
		 @dateFormat varchar(10),
		 @dateType int,
		 @ViewRelatedToOthers NVARCHAR(MAX),
		 @UnauthorizedUsers	  NVARCHAR(MAX),
		 @UserID int,
		 @ViewRelatedToUser int
		 ',
	     @DateType = @DateType,
	     @DateFormat = @DateFormat,
	     @ViewRelatedToUser = @ViewRelatedToUser,
	     @ViewRelatedToOthers = @ViewRelatedToOthers,
	     @UnauthorizedUsers = @UnauthorizedUsers,
	     @UserID = @UserID

	
	
	DECLARE @Count INT
	
	
	EXEC ('select * from ' + @tableName + ' order by _RN');
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)
END
