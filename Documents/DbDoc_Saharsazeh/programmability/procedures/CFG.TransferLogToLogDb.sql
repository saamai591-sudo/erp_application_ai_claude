/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.5.444
 * Time: 4/13/2019 12:40:34 PM
 ************************************************************/

CREATE PROCEDURE [CFG].[TransferLogToLogDb]
AS
	DECLARE @DbName VARCHAR(512)
	
	
	SELECT @DbName = c.ConfigValue
	FROM   cfg.Configuration AS c
	WHERE  c.ConfigKey = 'LogDB'
	
	
	
	IF @DbName IS NULL
	   OR @DbName = ''
	   OR @DbName = DB_NAME()
	BEGIN
		PRINT 'Is Equal'
	    RETURN
	END
	
	
	
	DECLARE @Query NVARCHAR(MAX)
	
	SET @Query='
	
	SET IDENTITY_INSERT '+@DbName+'.[CFG].[JsonLog] ON
	
	INSERT INTO '+@DbName+'.cfg.JsonLog
	  (
	    Id,
	    TableId,
	    ApplyDate,
	    UserId,
	    TransactionID,
	    OperationType,
	    ComputerName
	  )
	SELECT *
	FROM   cfg.JsonLog AS jl
	where Id not in (select id from '+@DbName+'.cfg.JsonLog )
	
	SET IDENTITY_INSERT '+@DbName+'.[CFG].[JsonLog] OFF
	
	
	
	
	INSERT INTO '+@DbName+'.cfg.JsonLogItem
	  (
	    
	    JsonLogId,
	    [Value],
	    EntityID,
	    OperationType
	  )
	SELECT  
		JsonLogId,
	    [Value],
	    EntityID,
	    OperationType
	FROM   cfg.JsonLogItem
	where JsonLogId in (select id from '+@DbName+'.cfg.JsonLog )
	
	
	
	
	--Empty Table
	ALTER TABLE [CFG].[JsonLogItem] DROP CONSTRAINT [FK_JsonLogItem_JsonLog]
	
	
	TRUNCATE TABLE [CFG].[JsonLogItem]
	TRUNCATE TABLE  [CFG].[JsonLog]
	
	ALTER TABLE [CFG].[JsonLogItem]  WITH CHECK ADD  CONSTRAINT [FK_JsonLogItem_JsonLog] FOREIGN KEY([JsonLogId])
	REFERENCES [CFG].[JsonLog] ([Id])


	ALTER TABLE [CFG].[JsonLogItem] CHECK CONSTRAINT [FK_JsonLogItem_JsonLog] '
	
	EXEC  (@Query)

	
