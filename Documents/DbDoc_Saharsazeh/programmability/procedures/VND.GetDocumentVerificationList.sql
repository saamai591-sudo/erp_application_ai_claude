
--------------------------------------------------------------
CREATE   PROCEDURE [VND].GetDocumentVerificationList
(
    @PageNumber INT,
    @RowspPage INT,
    @Sort NVARCHAR(MAX) = NULL,
    @Filter NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
DECLARE @UserID INT,
        @DateType TINYINT,
        @DateFormat VARCHAR(10),
        @ViewRelatedToUser INT,
        @ViewRelatedToOthers NVARCHAR(MAX),
        @Culture VARCHAR(25),
        @Query NVARCHAR(MAX),
        @UnauthorizedUsers NVARCHAR(MAX);


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


DECLARE @TenderRequest NVARCHAR(100),
        @Enactment NVARCHAR(100);

SELECT @TenderRequest = lev.Value
FROM CFG.LocalizeEnumValue AS lev
    JOIN CFG.LocalizeEnum AS le
        ON le.LocalizeEnumID = lev.LocalizeEnumID
WHERE le.Enum = 'DocumentVerificationTypes'
      AND le.Item = 'TenderRequest'
      AND lev.Culture = @Culture;


SELECT @Enactment = lev.Value
FROM CFG.LocalizeEnumValue AS lev
    JOIN CFG.LocalizeEnum AS le
        ON le.LocalizeEnumID = lev.LocalizeEnumID
WHERE le.Enum = 'DocumentVerificationTypes'
      AND le.Item = 'Enactment'
      AND lev.Culture = @Culture;
	 
SELECT @ViewRelatedToUser = UserID
FROM CFG.vwOperationLevelAccess
WHERE EntityName = 'DocumentVerification'
		AND AccessKey = 'ViewRelatedToUser'
		AND UserID = @UserID;

SELECT @ViewRelatedToOthers = UserID ,
       @UnauthorizedUsers = Users
FROM CFG.vwOperationLevelAccess
WHERE EntityName = 'DocumentVerification'
		AND AccessKey = 'ViewRelatedToOthers'
		AND UserID = @UserID;

IF @Sort IS NULL
   OR @Sort = ''
    SET @Sort = ' Number ';

SET @Query
    = N'with Query_Result as (
		select 
				r.DocumentVerificationID,
				CFG.GetCLRSaturnDate(r.Date, @DateFormat, 0, @DateType) Date_Date,
				r.Date,
				r.Number,
				r.BaseType,
				r.BaseID,
				r.DocumentVerificationPathItemID,
				p.Title DocumentVerificationPathItemTitle,
				r.Description,
				r.Description2,
				p.CreationDate,
				p.LastEditionDate,
				CFG.GetCLRSaturnDate(p.CreationDate, @DateFormat, 0, @DateType) CreateDateString,
				CFG.GetCLRSaturnDate(p.LastEditionDate, @DateFormat, 0, @DateType) EditionDateString,
				u1.Name CreatorUserName,
				u2.Name EditorName,
				r.Version,
				case when r.BaseType = 1 then tr.Number 
						when r.BaseType = 2 then enact.number
						end BaseDocumentNumber,
				case when r.BaseType = 1 then @TenderRequest
						when r.BaseType = 2 then @Enactment
						ELSE ''''
						end TypeString
		from VND.DocumentVerification r
			join VND.DocumentVerificationPathItem p on r.DocumentVerificationPathItemID = p.DocumentVerificationPathItemID
			JOIN CFG.[User] AS u1 ON u1.UserID = r.Creator 
			JOIN CFG.[User] AS u2 ON u2.UserID = r.LastEditor
			left join [REQ].[TenderRequest] tr on tr.TenderRequestID = r.BaseID and r.BaseType = 1
			left join
			(
				select enactmentID,b.number
				from vnd.enactment a
				join vnd.tender b on a.tenderid = b.tenderid
			) enact on enact.enactmentID = r.BaseID and r.BaseType = 2
		where (@UserID = -1
				OR (@ViewRelatedToUser IS NOT NULL AND r.Creator = @UserID)
				OR (@ViewRelatedToOthers IS NOT NULL AND r.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@UnauthorizedUsers) AS rfcst)
			)
		))';

DECLARE @selectQuery NVARCHAR(MAX);

IF @Filter IS NULL
   OR @Filter = ''
    SET @Filter = '';
ELSE
    SET @Filter = 'Where (' + @Filter + ')';


DECLARE @tableName VARCHAR(100);
SET @tableName = CFG.getTempTableName(1);

SET @Query = CFG.ApplyPaging(@tableName, @Query, @PageNumber, @RowspPage, @Filter, @Sort);


EXECUTE sp_executesql @Query,
      N'@dateFormat varchar(10),
		@dateType int,
		@ViewRelatedToOthers NVARCHAR(MAX),
		@UnauthorizedUsers	 NVARCHAR(MAX),
		@UserID int,
		@ViewRelatedToUser NVARCHAR(MAX),
		@TenderRequest NVARCHAR(100),
        @Enactment NVARCHAR(100)',
        @DateType = @DateType,
        @DateFormat = @DateFormat,
        @ViewRelatedToUser = @ViewRelatedToUser,
        @UserID = @UserID,
        @ViewRelatedToOthers = @ViewRelatedToOthers,
        @UnauthorizedUsers = @UnauthorizedUsers,
        @TenderRequest = @TenderRequest,
        @Enactment = @Enactment;

DECLARE @Count INT;

EXEC ('select * from ' + @tableName + ' ORDER BY _RN');

SET @Query = N'select top 1 @Count=  r_count from ' + @tableName;
EXECUTE sp_executesql @Query, N'@count int out', @Count = @Count OUT;

RETURN ISNULL(@Count, 0);
