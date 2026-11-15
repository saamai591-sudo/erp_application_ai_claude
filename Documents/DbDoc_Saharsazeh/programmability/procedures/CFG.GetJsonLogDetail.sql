
CREATE   PROCEDURE [CFG].[GetJsonLogDetail]
(@JsonLogIetmId INT)
AS
BEGIN

    DECLARE @TrId BIGINT,
            @EntityId BIGINT,
            @TableId INT,
            @OperationType TINYINT,
            @Value NVARCHAR(MAX),
            @OldValue NVARCHAR(MAX),
            @JsonLogId BIGINT,
            @TableKey VARCHAR(256);

    DECLARE @DbName VARCHAR(512);

    SELECT @DbName = CASE
                         WHEN @DbName IS NULL
                              OR @DbName = '' THEN
                             NULL
                         ELSE
                             QUOTENAME(c.ConfigValue)
                     END
    FROM CFG.Configuration AS c
    WHERE c.ConfigKey = 'LogDB';

    IF @DbName IS NULL
       OR @DbName = ''
        SET @DbName = QUOTENAME(DB_NAME());

    DECLARE @Query NVARCHAR(MAX);

    CREATE TABLE #T
    (
        Id BIGINT,
        [TransactionID] BIGINT,
        [TableId] INT,
        [EntityID] BIGINT,
        [OperationType] TINYINT,
        [Value] NVARCHAR(4000),
        [JsonLogId] BIGINT
    );

    SET @Query
        = N'Insert into #T
		select jli.Id, jl.TransactionID,jl.TableId,jli.EntityID,
		 jli.OperationType,jli.[Value],
		jli.JsonLogId
		  from ' + @DbName + N'.cfg.JsonLog                 AS jl
	       INNER JOIN ' + @DbName
          + N'.Cfg.JsonLogItem  AS jli
	            ON  jli.JsonLogId = jl.Id
		WHERE  jli.Id = ' + CAST(@JsonLogIetmId AS VARCHAR(48));

    --PRINT @Query;
    EXEC (@Query);

    SELECT @TrId = TransactionID,
           @TableId = TableId,
           @EntityId = EntityID,
           @OperationType = OperationType,
           @Value = [Value],
           @JsonLogId = JsonLogId
    FROM #T
    WHERE Id = @JsonLogIetmId;

    IF @OperationType = 3
    BEGIN
        SET @Query
            = N'
	    SELECT @OldValue = [Value]
	    FROM   ' + @DbName
              + N'.cfg.JsonLogItem
	    WHERE  EntityID              = @EntityId
	           AND JsonLogId         = @JsonLogId
	           AND OperationType     = 4 ';

        EXECUTE sp_executesql @Query,
                              N'@EntityId bigint,@JsonLogId bigint,@OldValue nvarchar(4000) out',
                              @EntityId = @EntityId,
                              @JsonLogId = @JsonLogId,
                              @OldValue = @OldValue OUT;
    END;

    DECLARE @EntityName VARCHAR(100);

    SELECT @EntityName = m2.Name
    FROM MDT.DmdTable AS m
        JOIN MDT.DmdEntityTableRelation AS mtr2
            ON m.ID = mtr2.DmdTableID
        JOIN MDT.DmdEntity AS m2
            ON m2.ID = mtr2.DmdEntityID
    WHERE mtr2.RelationType = 1
          AND m.ID = @TableId;

    SELECT @TableKey = m3.Name
    FROM MDT.DmdTable AS m
        JOIN MDT.DmdColumn AS m3
            ON m.Name = m3.TableName
    WHERE m3.IsKey = 1
          AND m.ID = @TableId;

    DECLARE @Items NVARCHAR(MAX),
            @OldItems NVARCHAR(MAX);

    SET @Items = N'';
    SET @OldItems = N'';

    SET @Query
        = N'
	SELECT @Items = @Items + '','' + jli.[Value],
	       @OldItems = @OldItems + '','' + TOlad.[Value]
	FROM   ' + @DbName
          + N'.cfg.JsonLog JSL
	       INNER JOIN (
	                SELECT m.Name,
						   m.ID
					FROM MDT.DmdTable AS m
						JOIN MDT.DmdEntityTableRelation AS mtr2 ON m.ID = mtr2.DmdTableID
						JOIN MDT.DmdEntity AS m2 ON m2.ID = mtr2.DmdEntityID
					WHERE mtr2.RelationType = 2 AND @EntityName = m2.Name
	            )T
	            ON  T.Id = JSL.TableId AND JSL.TransactionID = @TrId
	       INNER JOIN ' + @DbName
          + N'.cfg.JsonLogItem AS jli ON  jli.JsonLogId = JSL.Id
	       LEFT JOIN (
	                SELECT jli2.JsonLogId,
	                       jli2.EntityID,
	                       jli2.[Value]
	                FROM   ' + @DbName
          + N'.cfg.JsonLogItem AS jli2
	                WHERE  jli2.OperationType = 4
	            )TOlad ON  TOlad.JsonLogId = jli.JsonLogId AND TOlad.EntityID = jli.EntityID
	WHERE  jli.OperationType IN (1, 2, 3)
	       AND json_value(jli.[Value], ''$.'' + @TableKey) = @EntityId ';

    EXECUTE sp_executesql @Query,
                          N'@TableKey varchar(100),@EntityName varchar(100),@TrId bigint,@EntityId bigint,@OldItems nvarchar(MAX) out, @Items nvarchar(MAX) out',
                          @EntityId = @EntityId,
                          @EntityName = @EntityName,
                          @TableKey = @TableKey,
                          @TrId = @TrId,
                          @Items = @Items OUT,
                          @OldItems = @OldItems OUT;

    IF @Items IS NOT NULL
       AND @Items <> ''
        SET @Value = JSON_MODIFY(@Value, ' $.Items', JSON_QUERY('[' + SUBSTRING(@Items, 2, LEN(@Items) - 1) + ']'));

    IF @OldValue IS NOT NULL
       AND @OldItems <> ''
       AND @OldItems IS NOT NULL
        SET @OldValue
            = JSON_MODIFY(@OldValue, ' $.Items', JSON_QUERY('[' + SUBSTRING(@OldItems, 2, LEN(@OldItems) - 1) + ']'));

    SELECT @Value AS [Value],
           @OldValue AS [Value1];
END;
