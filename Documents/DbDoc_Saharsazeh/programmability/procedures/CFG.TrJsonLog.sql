CREATE   PROCEDURE [CFG].[TrJsonLog](
    @ProcId        BIGINT,
    @NewValues     NVARCHAR(MAX),
    @OldValues     NVARCHAR(MAX)
)
AS
	IF @NewValues IS NULL
	   AND @OldValues IS NULL
	    RETURN
	
	DECLARE @TableScheme     VARCHAR(8),
	        @tableName       VARCHAR(256),
	        @TableID         INT
	
	SELECT @TableScheme = object_schema_name(parent_id),
	       @tableName     = OBJECT_NAME(parent_id)
	FROM   sys.triggers
	WHERE  OBJECT_ID      = @ProcId
	
	DECLARE @ComputerName NVARCHAR(50)
	DECLARE @UserId INT
	DECLARE @Key VARCHAR(128)
	
	
	DECLARE @OperationType0     TINYINT,
	        @OperationType1     TINYINT,
	        @TransactionId      BIGINT,
	        @JsonLogId          BIGINT
	
	
	SET @TransactionId = CURRENT_TRANSACTION_ID()  
	 
	
	SET @ComputerName = cfg.GetComputerName()
	SET @UserId = cfg.GetUserId() 
	
	
	SELECT @Key = m.Name
	FROM   mdt.DmdColumn AS m
	WHERE  m.IsKey = 1
	       AND m.TableName = @tableName
	       AND m.TableSchema = @TableScheme
	
	SELECT @TableID = m.Id
	FROM   mdt.DmdTable AS m
	WHERE  m.Name = @tableName
	       AND m.[Schema] = @TableScheme
	
	
	IF @NewValues IS NOT NULL
	   AND @OldValues IS NOT NULL
	BEGIN
	    SET @OperationType0 = 3
	    SET @OperationType1 = 4
	END
	ELSE  
	IF @NewValues IS NOT NULL
	BEGIN
	    SET @OperationType1 = 1
	    SET @OperationType0 = 1
	END
	ELSE  
	IF @OLdValues IS NOT NULL
	BEGIN
	    SET @OperationType1 = 2
	    SET @OperationType0 = 2
	END
	
	
	INSERT INTO cfg.JsonLog
	  (
	    -- Id -- this column value is auto-generated
	    TableId,
	    ApplyDate,
	    UserId,
	    TransactionID,
	    OperationType,
	    ComputerName
	  )
	VALUES
	  (
	    @TableID,
	    GETDATE(),
	    @userId,
	    @TransactionId,
	    @OperationType0,
	    @ComputerName
	  )
	
	SET @JsonLogId = SCOPE_IDENTITY()
	
	
	IF @NewValues IS NOT NULL
	    INSERT INTO cfg.JsonLogItem
	      (
	        JsonLogId,
	        [Value],
	        EntityID,
	        OperationType
	      )
	    SELECT @JsonLogId,
	           [Value],
	           JSON_Value([Value], '$.' + @Key),
	           @OperationType0
	    FROM   OPENJSON(@NewValues)t
	
	IF @oldvalues IS NOT NULL
	    INSERT INTO cfg.JsonLogItem
	      (
	        JsonLogId,
	        [Value],
	        EntityID,
	        OperationType
	      )
	    SELECT @JsonLogId,
	           [Value],
	           JSON_Value([Value], '$.' + @Key),
	           @OperationType1
	    FROM   OPENJSON(@OldValues) t
