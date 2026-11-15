
CREATE PROCEDURE [CFG].[MergeParty](@SourcePartyId BIGINT, @DesPartyId BIGINT)
AS
	DECLARE @SourceDlId BIGINT,
	        @DesDlId BIGINT
	
	DECLARE @RefTable         VARCHAR(200),
	        @REfColumn        VARCHAR(200),
	        @RefTableDesc     NVARCHAR(500),
	        @TABLE_SCHEMA     VARCHAR(100)
	
	
	SELECT @SourceDlId = p.DlID
	FROM   cfg.Party AS p
	WHERE  p.PartyID = @SourcePartyId
	
	SELECT @DesDlId = p.DlID
	FROM   cfg.Party AS p
	WHERE  p.PartyID = @DesPartyId
	
	
	DECLARE @Q NVARCHAR(MAX)
	
	SET @Q = ''
	
	SELECT FK.TABLE_NAME,
	       CU.COLUMN_NAME,
	       FK.TABLE_NAME AS t,
	       FK.TABLE_SCHEMA
	INTO   #Tdata
	FROM   INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS C
	       INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS FK
	            ON  C.CONSTRAINT_NAME = FK.CONSTRAINT_NAME
	       INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS PK
	            ON  C.UNIQUE_CONSTRAINT_NAME = PK.CONSTRAINT_NAME
	       INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE CU
	            ON  C.CONSTRAINT_NAME = CU.CONSTRAINT_NAME
	       INNER JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE CCU
	            ON  PK.CONSTRAINT_NAME = CCU.CONSTRAINT_NAME
	WHERE  (FK.CONSTRAINT_TYPE = 'FOREIGN KEY')
	       AND PK.TABLE_NAME = 'Party'
	       AND C.DELETE_RULE <> 'CASCADE'
	       AND FK.TABLE_NAME<>'DL'
	
	DECLARE R CURSOR 
	FOR
	    SELECT *
	    FROM   #Tdata
	
	OPEN R
	
	FETCH NEXT FROM R
	INTO @RefTable,@REfColumn,@RefTableDesc,@TABLE_SCHEMA
	
	WHILE @@FETCH_STATUS = 0
	BEGIN
	    SET @Q = @Q + ' Update ' + @TABLE_SCHEMA + '.[' + @RefTable + '] Set ' + @REfColumn + '=' + CAST(@DesPartyId AS VARCHAR(100))
	        + ' where ' + @REfColumn + '=' + CAST(@SourcePartyId AS VARCHAR(100)) + ';'
	    
	    FETCH NEXT FROM R
	    INTO @RefTable,@REfColumn,@RefTableDesc,@TABLE_SCHEMA
	END
	
	CLOSE R
	DEALLOCATE R
	
	
	IF @DesDlId IS NOT NULL and @DesDlId <> @SourceDlId
	BEGIN
	    SELECT FK.TABLE_NAME,
	           CU.COLUMN_NAME,
	           FK.TABLE_NAME AS t,
	           FK.TABLE_SCHEMA
	    INTO   #Tdata2
	    FROM   INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS C
	           INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS FK
	                ON  C.CONSTRAINT_NAME = FK.CONSTRAINT_NAME
	           INNER JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS PK
	                ON  C.UNIQUE_CONSTRAINT_NAME = PK.CONSTRAINT_NAME
	           INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE CU
	                ON  C.CONSTRAINT_NAME = CU.CONSTRAINT_NAME
	           INNER JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE CCU
	                ON  PK.CONSTRAINT_NAME = CCU.CONSTRAINT_NAME
	    WHERE  (FK.CONSTRAINT_TYPE = 'FOREIGN KEY')
	           AND PK.TABLE_NAME = 'DL'
	           AND C.DELETE_RULE <> 'CASCADE'
	            AND FK.TABLE_NAME<>'PARTY'
	    


	    DECLARE R2 CURSOR 
	    FOR
	        SELECT *
	        FROM   #Tdata2
	    
	    OPEN R2
	    
	    FETCH NEXT FROM R2
	    INTO @RefTable,@REfColumn,@RefTableDesc,@TABLE_SCHEMA
	    
	    WHILE @@FETCH_STATUS = 0
	    BEGIN
	        SET @Q = @Q + ' Update ' + @TABLE_SCHEMA + '.[' + @RefTable + '] Set ' + @REfColumn + '=' + CAST(@DESdlId AS VARCHAR(100))
	            + ' where ' + @REfColumn + '=' + CAST(@SourceDlId AS VARCHAR(100)) + ';'
	        
	        IF @RefTable ='Outgoing'
				PRINT ' Update ' + @TABLE_SCHEMA + '.[' + @RefTable + '] Set ' + @REfColumn + '=' + CAST(@DESdlId AS VARCHAR(100))
	            + ' where ' + @REfColumn + '=' + CAST(@SourceDlId AS VARCHAR(100)) + ';'
	        FETCH NEXT FROM R2
	        INTO @RefTable,@REfColumn,@RefTableDesc,@TABLE_SCHEMA
	    END
	    
	    CLOSE R2
	    DEALLOCATE R2
	END
	
	
	UPDATE cfg.[Address]
	SET PartyID = @DesPartyId
	WHERE PartyID=@SourcePartyId
	
	
	UPDATE cfg.Phone
	SET PartyID  = @DesPartyId
	WHERE PartyID=@SourcePartyId
	
	EXEC (@Q)
	
	
	
	
	DELETE Cfg.Party
	WHERE  PartyID = @SourcePartyId
	
	IF @DesDlId IS NOT NULL and @DesDlId <> @SourceDlId
	DELETE Acc.DL
	WHERE  DLID = @SourceDlId
