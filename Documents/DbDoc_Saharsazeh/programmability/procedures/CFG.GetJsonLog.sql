
/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 22/02/95 12:41:50 عصر
 ************************************************************/

CREATE PROCEDURE [CFG].[GetJsonLog](
    @PageNumber     INT,
    @RowspPage      INT,
    @Sort           NVARCHAR(MAX) = NULL,
    @Filter         NVARCHAR(MAX) = NULL
)
AS
	DECLARE @UserID         INT,
	        @DateType       TINYINT,
	        @DateFormat     VARCHAR(10)
	
	SET @UserID = cfg.GetuserID()
	
	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE cfg.GetuserCulture()
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
	
	
	IF @Sort IS NULL
	   OR @Sort = ''
	   OR @Sort = 'ApplyDatePersian'
	    SET @Sort = 'ApplyDate '
	
	DECLARE @Query NVARCHAR(MAX)    
	SET @Query = 
	    '
	    WITH Query_Result 
			(
				TableId,
				ApplyDate,
		UserId,
		TransactionID,
		SquenceId,
		OperationType,
		EntityID,
		
		ApplyDatePersian
			)
			As (
				
				SELECT jl.TableId, jl.ApplyDate, jl.UserId, jl.TransactionID, jl.SquenceId,
       jl.OperationType, jli.EntityID, 
         CFG.GetCLRSaturnDate(jl.[ApplyDate],@DateFormat  , 0,@DateType)AS ApplyDatePersian
  FROM cfg.JsonLog AS jl
INNER JOIN cfg.JsonLogItem AS jli
ON jli.JsonLogId = jl.Id 
)
		
	    '
	
	
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
	     N'@dateFormat varchar(10),@dateType int,
@UserID int',
	     @DateType = @DateType,
	     @DateFormat = @DateFormat,
	     @UserID = @UserID
	--WHERE  ttt.PersonelID = 6582
	
	
	DECLARE @Count INT
	
	
	EXEC ('select * from ' + @tableName)
	
	SET @Query = 'select top 1 @Count=  r_count from ' + @tableName 
	EXECUTE sp_executesql @Query,
	     N'@count int out',
	     @Count = @Count OUT
	
	RETURN ISNULL(@Count, 0)
