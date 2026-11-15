CREATE proc [CFG].[LogReport_Voucher]

	@FromDate varchar(10)=NULL,
	@ToDate varchar(10)=NULL,
	@Operation		varchar(255)=NULL,
	@TableName	nvarchar(50),
	@Schema varchar(50)=NULL

		--with encryption
AS

	DECLARE @UserID                  INT,
	        @DateType                 VARCHAR(10),
	        @DateFormat              VARCHAR(10),
			@Culture                 VARCHAR(10),
        @Record NVARCHAR(100),
        @Note NVARCHAR(100),
        @Survey NVARCHAR(100),
        @Confirm NVARCHAR(100)

	SET @UserID = cfg.GetuserID();
	set @Culture = cfg.GetuserCulture();

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE @Culture
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

SELECT @Record = LEV.Value
FROM CFG.LocalizeEnumValue LEV
    INNER JOIN CFG.LocalizeEnum LE
        ON LE.LocalizeEnumID = LEV.LocalizeEnumID
WHERE LE.Enum = 'VoucherStatuses'
      AND LE.Item = 'Record'
      AND LEV.Culture = @Culture;

SELECT @Note = LEV.Value
FROM CFG.LocalizeEnumValue LEV
    INNER JOIN CFG.LocalizeEnum LE
        ON LE.LocalizeEnumID = LEV.LocalizeEnumID
WHERE LE.Enum = 'VoucherStatuses'
      AND LE.Item = 'Note'
      AND LEV.Culture = @Culture;

SELECT @Survey = LEV.Value
FROM CFG.LocalizeEnumValue LEV
    INNER JOIN CFG.LocalizeEnum LE
        ON LE.LocalizeEnumID = LEV.LocalizeEnumID
WHERE LE.Enum = 'VoucherStatuses'
      AND LE.Item = 'Survey'
      AND LEV.Culture = @Culture;

SELECT @Confirm = LEV.Value
FROM CFG.LocalizeEnumValue LEV
    INNER JOIN CFG.LocalizeEnum LE
        ON LE.LocalizeEnumID = LEV.LocalizeEnumID
WHERE LE.Enum = 'VoucherStatuses'
      AND LE.Item = 'Confirm'
      AND LEV.Culture = @Culture;

DECLARE @TempTable VARCHAR(100)

SET @TempTable=cfg.getTempTableName(1)

exec [CFG].[SpXmlSearch] @FromDate,@ToDate,@Operation,@TableName,null,@Schema,0,@TempTable

DECLARE @Query NVARCHAR(MAX)


SET @Query=N'SELECT        [شناسه تغییرات] as ''شناسه تغییرات'',
			  case when [نوع عمليات] = 1  then ''ایجاد''
				   when [نوع عمليات] = 2  then ''حذف''
				   when [نوع عمليات] = 3  then ''ویرایش''
				   end as ''نوع عملیات'',
			  u.Name as ''کاربر'',   
			  [وضعيت] as ''وضعیت'', 
			  [زمان عمليات] as ''ساعت تغییرات'', 
			  [تاريخ عمليات] As ''تاریخ تغییرات'', 
			   [ادرس کلاينت] as ''نام کامپیوتر'',
			  s.Number as ''شماره سند'', 
			  s.ReferenceNumber as ''شماره عطف'', 
			  s.DailyNumber as ''شماره روزانه'', 
			  s.SubNumber as ''شماره فرعی'', 
			  b.Title as ''شعبه'', 
			  d.Title as ''نوع سند'', 
			  CFG.GetCLRSaturnDate(s.Date, '''+@DateFormat+''', 0, '+@DateType+') AS ''تاریخ سند'', 
			   CASE s.VoucherStatusID
					WHEN 1 THEN @Record
					WHEN 2 THEN @Note
					WHEN 3 THEN @Survey
					WHEN 4 THEN @Confirm
			   END AS N''وضعیت سند'', 
			  s.Description as ''شرح سند''			  
	
FROM            '+@TempTable+' AS s
 INNER JOIN cfg.branch b on b.BranchID = s.BranchID
 INNER JOIN acc.DocumentType d on d.DocumentTypeID = s.DocumentTypeID
 INNER JOIN  cfg.[user] u on u.userid = s.[کليد کاربر]
order by [شناسه تغییرات] '


EXEC sys.sp_executesql @Query, N'@Record NVARCHAR(100),
		@Note NVARCHAR(100),
		@Survey NVARCHAR(100),
		@Confirm NVARCHAR(100)
',
                       @Record = @Record,
                       @Note = @Note,
                       @Survey = @Survey,
                       @Confirm = @Confirm;
