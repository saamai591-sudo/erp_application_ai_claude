CREATE PROC [CFG].[LogReport_AccountLevelVoucherItem]
    @FromDate VARCHAR(10) = NULL,
    @ToDate VARCHAR(10) = NULL,
    @Operation VARCHAR(255) = NULL,
    @TableName NVARCHAR(50),
    @Schema VARCHAR(50) = NULL

--with encryption
AS
DECLARE @UserID INT,
        @DateType VARCHAR(10),
        @DateFormat VARCHAR(10),
        @Culture VARCHAR(10),
        @Record NVARCHAR(100),
        @Note NVARCHAR(100),
        @Survey NVARCHAR(100),
        @Confirm NVARCHAR(100);

SET @UserID = CFG.GetuserID();
SET @Culture = CFG.GetuserCulture();

SELECT @DateType = us.SettingValue
FROM CFG.UserSetting us
WHERE us.SettingKey = 'Date_Type'
      AND us.UserID = @UserID;

IF @DateType IS NULL
    SET @DateType = CASE @Culture
                        WHEN 'fa' THEN
                            0
                        WHEN 'en' THEN
                            1
                        WHEN 'ar' THEN
                            2
                    END;

SELECT @DateFormat = us.SettingValue
FROM CFG.UserSetting us
WHERE us.SettingKey = 'Date_Format'
      AND us.UserID = @UserID;

IF @DateFormat IS NULL
    SET @DateFormat = 'YY/MM/DD';

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


DECLARE @TempTable VARCHAR(100);

SET @TempTable = CFG.getTempTableName(1);
EXEC [CFG].[SpXmlSearch] @FromDate,
                         @ToDate,
                         @Operation,
                         @TableName,
                         NULL,
                         @Schema,
                         0,
                         @TempTable;

DECLARE @Query NVARCHAR(MAX);

SET @Query
    = N'


SELECT      [شناسه تغییرات] as ''شناسه تغییرات'',
			  case when [نوع عمليات] = 1  then ''ایجاد''
				   when [نوع عمليات] = 2  then ''حذف''
				   when [نوع عمليات] = 3  then ''ویرایش''
				   end as N''نوع عملیات'',
			  u.Name as N''کاربر'',   
			  [وضعيت] as N''وضعیت'', 
			  [زمان عمليات] as N''ساعت تغییرات'', 
			  [تاريخ عمليات] As N''تاریخ تغییرات'', 
			   [ادرس کلاينت] as N''نام کامپیوتر'',
			  ---------------------------------------------
			  v.Number as N''شماره سند'', 
			  v.ReferenceNumber as N''شماره عطف'', 
			  v.DailyNumber as N''شماره روزانه'', 
			  v.SubNumber as N''شماره فرعی'', 
			  b.Title as N''شعبه'', 
			  d.Title as N''نوع سند'', 
			  CFG.GetCLRSaturnDate(s.Date, ''' + @DateFormat + N''', 0, ' + @DateType
      + N') AS  N''تاریخ سند'', 
			  CASE v.VoucherStatusID 
					WHEN 1 THEN @Record
					WHEN 2 THEN @Note
					WHEN 3 THEN @Survey
					WHEN 4 THEN @Confirm
			   END AS N''وضعیت سند'', 
			  v.Description as N''شرح سند''		,
			  vw.SlCode as N''معین''	  ,
			  s.Description as N''شرح ردیف'',
			  s.debit as N''بدهکار'',
			  s.credit as N''بستانکار''
	
FROM               ' + @TempTable
      + N' AS s
 INNER JOIN acc.voucher v on v.voucherid = s.voucherid
 INNER JOIN cfg.branch b on b.BranchID = s.BranchID
 INNER JOIN acc.DocumentType d on d.DocumentTypeID = v.DocumentTypeID
 INNER JOIN  cfg.[user] u on u.userid =.[کليد کاربر]
 INNER JOIN  acc.vwaccounts vw on vw.slid = s.slid
order by [شناسه تغییرات] ';


EXEC sys.sp_executesql @Query,
                       N'@Record NVARCHAR(100),
		@Note NVARCHAR(100),
		@Survey NVARCHAR(100),
		@Confirm NVARCHAR(100)
',
                       @Record = @Record,
                       @Note = @Note,
                       @Survey = @Survey,
                       @Confirm = @Confirm;
