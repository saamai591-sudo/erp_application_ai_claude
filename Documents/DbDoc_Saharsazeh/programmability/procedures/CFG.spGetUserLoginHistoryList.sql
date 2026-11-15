CREATE    PROC [CFG].[spGetUserLoginHistoryList]
(
    @UserId INT,
    
    @TokenIds NVARCHAR(MAX) = NULL,
    @PageNumber INT,
    @RowspPage INT,
    @Sort NVARCHAR(MAX) = NULL,
    @Filter NVARCHAR(MAX) = NULL
)
--with encryption
AS
DECLARE @DateType TINYINT,
        @DateFormat VARCHAR(10),
        @Culture VARCHAR(25);

SET @UserId = CFG.GetuserID();
SET @Culture = CFG.GetuserCulture();

SELECT @DateType = us.SettingValue
FROM CFG.UserSetting us
WHERE us.SettingKey = 'Date_Type'
      AND us.UserID = @UserId;

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
      AND us.UserID = @UserId;

IF @DateFormat IS NULL
    SET @DateFormat = 'YY/MM/DD';

IF @Sort IS NULL
   OR @Sort = ''
    SET @Sort = 'Date_LoginDate desc';

DECLARE @Query NVARCHAR(MAX);

SELECT value
INTO #tokens
FROM CFG.R_FnCommaStr2Table(@TokenIds);

SET @Query
    = N'
	    WITH Query_Result AS (
			select u.UserLoginHistoryID,			       
				   u.LoginDate,
				   CFG.GetCLRSaturnDate(u.LoginDate, @DateFormat , 1, @DateType) AS Date_LoginDate,
		           u.IsSucceed,
		           u.FailCause,
		           u.DbName,
		           u.ClientAppId,
		           u.ClientIp,
                   u.UserAgent,
		           u.LogoutDate,
		           CFG.GetCLRSaturnDate(u.LogoutDate, @DateFormat , 1, @DateType) AS Date_LogoutDate,
		           u.TokenID,
				   cast(case when t.value is not null then 1
				        else 0
				   end as bit) as Active,
                    '''' AS ConnectionId,
					CAST(u.UserLoginHistoryID AS BIGINT) AS ViewModelId,
					u.UserID,
					u.UserName
		    from CFG.UserLoginHistory u
	        join CFG.[User] u2 on u.UserName = u2.Username
			left join #tokens t on u.TokenID = t.value
	        where u2.UserID = @UserId 
		)';

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
                      N'@UserId int,
		  
		  @TokenIds NVARCHAR(MAX) = NULL,
		  @DateType TINYINT,
		  @DateFormat VARCHAR(10),
		  @Culture VARCHAR(25)',
                      @UserId = @UserId,
                     
                      @TokenIds = @TokenIds,
                      @DateType = @DateType,
                      @DateFormat = @DateFormat,
                      @Culture = @Culture;

DECLARE @Count INT;

EXEC ('select * from ' + @tableName + ' ORDER BY _RN');

SET @Query = N'select top 1 @Count=  r_count from ' + @tableName;
EXECUTE sp_executesql @Query, N'@count int out', @Count = @Count OUT;

RETURN ISNULL(@Count, 0);
