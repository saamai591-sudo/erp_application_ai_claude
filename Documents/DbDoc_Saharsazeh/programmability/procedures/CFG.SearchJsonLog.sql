CREATE    PROCEDURE [CFG].SearchJsonLog
(
    @pageIndex INT = 1,
    @PageSize INT = 100,
    @EntityKey VARCHAR(50) = NULL,
    @TableId INT = NULL,
    @userId INT = NULL,
    @TranID BIGINT = NULL,
    @EntityId BIGINT = NULL,
    @FromDate DATETIME = NULL,
    @ToDate DATETIME = NULL,
    @new BIT = 1,
    @delete BIT = 1,
    @edit BIT = 1,
    @FilterValue NVARCHAR(MAX) = NULL,
    @IsForFile BIT = 0,
    @Sort INT = 0
)
AS
BEGIN

    IF @IsForFile = 1
    BEGIN
        SET @PageSize = 10000;
        SET @pageIndex = 1;
    END;
    ELSE
        SET @PageSize = 100;

    DECLARE @DbName VARCHAR(512);

    SELECT @DbName = c.ConfigValue
    FROM CFG.Configuration AS c
    WHERE c.ConfigKey = 'LogDB';

    IF @DbName IS NULL
       OR @DbName = ''
        SET @DbName = DB_NAME();
	
    DECLARE @Query NVARCHAR(MAX);

    DECLARE @CurrentUserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10);

    SET @CurrentUserID = CFG.GetuserID();

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @CurrentUserID;

    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
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
          AND us.UserID = @CurrentUserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT de.[Name] EntityKey,
           dti.[Value] Title
    INTO #entities
    FROM MDT.DmdEntity AS de
        JOIN MDT.DmdRelatedEntityTranslate AS dret
            ON dret.DmdEntityID = de.ID
        JOIN MDT.DmdTranslateItem AS dti
            ON dti.ID = dret.DmdTranslateItemID
    WHERE dti.Lang = 1;

    SELECT de.[Name] AS EntityName,
           dt.[Name] AS TableName,
           dt.ID AS TableId,
           detr.RelationType
    INTO #meta
    FROM MDT.DmdTable AS dt
        JOIN MDT.DmdEntityTableRelation AS detr
            ON dt.ID = detr.DmdTableID
        JOIN MDT.DmdEntity AS de
            ON de.ID = detr.DmdEntityID
    WHERE detr.RelationType = 1
          AND
          (
              @EntityKey IS NULL
              OR de.Name = @EntityKey
          );

    CREATE TABLE #jl
    (
        [Id] BIGINT,
        [ApplyDate] DATETIME,
        [UserId] INT,
        [TableId] INT,
        [TransactionID] BIGINT,
        [OperationType] TINYINT,
        EntityName VARCHAR(100)
    );

    SET @Query
        = N' 
	INSERT INTO #jl
	(
		Id,
		ApplyDate,
		UserId,
		TableId,
		TransactionID,
		OperationType,
		EntityName
	)
	SELECT jl.Id,
	       jl.ApplyDate,
	       jl.UserId,
	       jl.TableId,
	       jl.TransactionID,
	       jl.OperationType,
	       EntityName
	FROM   ' + QUOTENAME(@DbName)
          + N'.cfg.JsonLog AS jl
	       INNER JOIN #meta ON  #meta.TableId = jl.TableId
	WHERE  (@tableId IS NULL OR jl.TableId = @tableId)
	       AND (@tranID IS NULL OR TransactionID = @tranID)
	       AND (@userId IS NULL OR UserId = @USerId)
	       AND (@FromDate IS NULL OR cast(ApplyDate AS DATE) >= @FromDate)
	       AND (@ToDate IS NULL OR cast(ApplyDate AS DATE) <= @ToDate)
	       AND (@new = 1 OR OperationType <> 1)
	       AND (@Delete = 1 OR OperationType <> 2)
	       AND (@Edit = 1 OR OperationType <> 3)
	';

    PRINT @Query;

    EXECUTE sp_executesql @Query,
                          N'@tableId int,@tranID bigint,@userId int,@FromDate Date,
									@ToDate  Date,@new bit, @Delete bit,@Edit bit',
                          @TableId = @TableId,
                          @TranID = @TranID,
                          @userId = @userId,
                          @FromDate = @FromDate,
                          @ToDate = @ToDate,
                          @new = @new,
                          @delete = @delete,
                          @edit = @edit;

    CREATE TABLE #result
    (
        [Id] BIGINT,
        TableId INT,
        ApplyDate DATE,
        UserId INT,
        TransactionID BIGINT,
        OperationType TINYINT,
        EntityName VARCHAR(100),
        EntityID BIGINT,
        ItemId BIGINT
    );

    SET @Query
        = N'
	INSERT INTO #result
	SELECT jl.Id,
	       jl.TableId,
	       jl.ApplyDate,
	       jl.UserId,
	       jl.TransactionID,
	       jl.OperationType,
	       jl.EntityName,
	       jli.EntityID,
	       jli.Id AS ItemId
	FROM   #jl jl
	       INNER JOIN ' + @DbName
          + N'.cfg.JsonLogItem AS jli ON  jli.JsonLogId = jl.Id
	WHERE  jli.OperationType <> 4
	       AND (@EntityId IS NULL OR (jli.EntityID = @EntityId))
	ORDER BY
	       CASE @Sort 
				WHEN 0 then jl.id 
				WHEN 1 then jl.UserId
				WHEN 2 then jl.OperationType
				WHEN 3 then jl.TableId
				WHEN 4 then jl.ApplyDate
	       END	      
	OFFSET(@pageIndex - 1) * @pageSize ROWS	
	FETCH NEXT @PageSize ROWS ONLY;
	';

    PRINT @Query;

    EXECUTE sp_executesql @Query,
                          N' @EntityId bigInt,@Sort tinyint,@pageIndex int,@pageSize Int',
                          @EntityId = @EntityId,
                          @Sort = @Sort,
                          @pageIndex = @pageIndex,
                          @PageSize = @PageSize;

    SELECT Id,
           ItemId,
           -- TableName,
           TableId,
           ApplyDate,
           T.UserId,
           TransactionID,
           OperationType,
           CASE OperationType
               WHEN 1 THEN
                   'جدید'
               WHEN 2 THEN
                   'حذف'
               WHEN 3 THEN
                   'ویرایش'
           END OperationTypeTitle,
           EntityID,
           u.Name AS UserTitle,
           #entities.Title AS EntityTitle,
           CFG.GetCLRSaturnDate([ApplyDate], @DateFormat, 0, @DateType) AS ApplyDatePersian
    FROM #result T
        INNER JOIN CFG.[User] AS u
            ON u.UserID = T.UserId
        LEFT JOIN #entities
            ON #entities.EntityKey = T.EntityName;

END;