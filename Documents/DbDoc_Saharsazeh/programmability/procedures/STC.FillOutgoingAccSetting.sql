-----------------------------------------------------------------------------------------------------------------
CREATE   PROC STC.FillOutgoingAccSetting
(
    @OutgoingID INT,
    @errorMessage NVARCHAR(MAX) OUTPUT
)
--WITH ENCRYPTION 
AS
BEGIN
    IF OBJECT_ID('tempdb..##ARItems') IS NOT NULL
        DROP TABLE ##ARItems;


    DECLARE @LastRowIndex INT,
            @OutgoingType INT,
            @DeliverDlID INT,
            @DlTypeId INT,
            @StockDlTypeId INT,
            @TRACEID INT,
            @Number NVARCHAR(50),
            @CurrentDate DATETIME,
            @CurrentUser INT,
            @DlType INT,
            @StockDocumentType NVARCHAR(250),
            @SlBaseOnDl BIT,
            @dlcode VARCHAR(50),
            @StockToStockSL INT;

    SET @CurrentDate = GETDATE();
    SET @CurrentUser = CFG.GetuserID();
    SELECT @StockToStockSL = ConfigValue
    FROM CFG.Configuration
    WHERE ConfigKey = 'StockToStockSL';

    SELECT @DeliverDlID = SRTable.DeliverDlID,
           @OutgoingType = sdt.DocumentType,
           @Number = CAST(SRTable.Number AS VARCHAR(10)),
           @StockDocumentType = sdt.Title,
           @SlBaseOnDl = sdt.SlBaseOnDl
    FROM STC.Outgoing AS SRTable
    JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
        ON SRTable.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        INNER JOIN STF.Stock AS St
            ON SRTable.StockID = St.StockID
        INNER JOIN STC.StockDocumentType sdt
            ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
    WHERE SRTable.OutgoingID = @OutgoingID;


    IF EXISTS
    (
        SELECT *
        FROM STC.OutgoingItem
        WHERE OutgoingID = @OutgoingID
              AND Price = 0
    )
    BEGIN

        SET @errorMessage = 'برخی از ردیفها قیمت گذاری نشده اند.';
        RETURN;
    END;
    SELECT @DlTypeId = DlTypeID
    FROM ACC.DL
    WHERE DLID = @DeliverDlID;

    SELECT @dlcode = Code
    FROM ACC.DL
    WHERE DLID = @DeliverDlID;

    IF (@OutgoingType = 4)
    BEGIN

        DECLARE @TranslationBetweenStocksHasAccountingVoucher VARCHAR(300);
        SELECT TOP 1
               @TranslationBetweenStocksHasAccountingVoucher = sc.ConfigValue
        FROM CFG.Configuration sc
        WHERE sc.ConfigKey = 'TranslationBetweenStocksHasAccountingVoucher';

        IF LOWER(@TranslationBetweenStocksHasAccountingVoucher) = 'false'
        BEGIN
            DECLARE @NewLineChar AS CHAR(2) = CHAR(13) + CHAR(10);

            SELECT @errorMessage = lsv.[Value]
            FROM CFG.LocalizationSQLMessage ls
                JOIN CFG.LocalizationSQLMessageValue lsv
                    ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
            WHERE ls.SQLMessageCode = 'STC_spOutgoingPreVoucherInsert_2'
                  AND lsv.Culture = CFG.GetuserCulture();

            SET @errorMessage = REPLACE(@errorMessage, '{0}', @Number);
            SET @errorMessage = REPLACE(@errorMessage, '{1}', @NewLineChar);

            --STC_spOutgoingPreVoucherInsert_2
            RETURN;
        END;
        ELSE IF @StockToStockSL IS NULL
        BEGIN

            SET @errorMessage = 'در تنظیمات عمومی، معین واسط انتقال بین انبار مشخص نشده است.';
            RETURN;
        END;
    END;

    IF EXISTS (SELECT TraceID FROM STF.Trace WHERE DlTypeID IS NOT NULL)
    BEGIN

        DECLARE @Columns NVARCHAR(MAX),
                @ColumnsInALTERTable NVARCHAR(MAX),
                @ColumnsInSelectList NVARCHAR(MAX),
                @Query NVARCHAR(MAX),
                @QueryParam NVARCHAR(MAX);

        SELECT @ColumnsInALTERTable = STUFF(
        (
            SELECT DISTINCT
                   ' ,' + QUOTENAME(TraceID) + 'INT'
            FROM STF.Trace
            WHERE DlTypeID IS NOT NULL
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1   ,
        1   ,
        ''
                                           );


        SELECT @Columns = STUFF(
        (
            SELECT DISTINCT
                   ',' + QUOTENAME(TraceID)
            FROM STF.Trace
            WHERE DlTypeID IS NOT NULL
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'),
        1   ,
        1   ,
        ''
                               );

        SET @Query
            = N'Create TABLE ##ARItems
			(
			ItemId               INT,
	    	InventorySlID        INT,
	    	SlID         INT,
			StuffAccountGroup nvarchar(250),
	    	RowNum               INT ' + @ColumnsInALTERTable + N'
			)';
        EXEC (@Query);
        SET @Query
            = N'INSERT INTO ##ARItems
	      (
	        ItemId,
	        InventorySlID,
	        SlID,
			StuffAccountGroup,
	        RowNum, ' + @Columns
              + N'
	      )
	    SELECT ARI.OutgoingItemID,
	           sagas.InventorySlID,
	             case when @pOutgoingType = 4 then @StockToStockSL else wip.slid end,
			   stfacc.Title,
	          row_number() over(order by ARI.RowIndex),' + @Columns
              + N'	           
	    FROM   STC.Outgoing St
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON st.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
	    join stf.Stock stk on st.StockID = stk.StockID
	           LEFT JOIN stc.OutgoingItem ARI   ON  St.OutgoingID = ARI.OutgoingID
	           LEFT JOIN(select OutgoingItemID,TraceID,DLID
	           				 from stc.OutgoingItemTrace 
	                     WHERE DLID IS NOT NULL ) x
										pivot 
										(
											 max(DLID)
											for TraceID in ( ' + @Columns
              + N')
										) p  on ARI.OutgoingItemID = p.OutgoingItemID
	           LEFT JOIN stf.StuffDetail stfdtl ON  ARI.StuffID = stfdtl.StuffID
	           LEFT JOIN stf.StuffAccountGroup stfacc ON  stfacc.StuffAccountGroupID = stfdtl.StuffAccountGroupID
	           left join stf.StuffAccountGroupAccountSl sagas on stfacc.StuffAccountGroupID = sagas.StuffAccountGroupID
			   and stk.StockTypeID = sagas.StockTypeID
	           left join stf.StockDocumentTypeSlDl wip on wip.StuffAccountGroupID = stfacc.StuffAccountGroupID 
														and wip.StockDocumentTypeID = sdtb.StockDocumentTypeID
														and (wip.dlid is null or wip.DlID = st.DeliverDlID)
	    WHERE  St.OutgoingID = @pOutgoingID	     	     and ARI.price > 0
	    ORDER BY  ARI.RowIndex';

        SET @QueryParam = N'@pOutgoingID INT,@pOutgoingType int,@StockToStockSL int';
        EXECUTE sp_executesql @Query,
                              @QueryParam,
                              @pOutgoingID = @OutgoingID,
                              @pOutgoingType = @OutgoingType,
                              @StockToStockSL = @StockToStockSL;

    END;
    ELSE
    BEGIN
        CREATE TABLE ##ARItems
        (
            ItemId INT,
            InventorySlID INT,
            SlID INT,
            StuffAccountGroup NVARCHAR(250),
            RowNum INT
        );

        INSERT INTO ##ARItems
        (
            ItemId,
            InventorySlID,
            SlID,
            StuffAccountGroup,
            RowNum
        )
        SELECT ARI.OutgoingItemID,
               sl.InventorySlID,
               CASE
                   WHEN @OutgoingType = 4 THEN
                       @StockToStockSL
                   ELSE
                       wip.SlID
               END,
               stfacc.Title,
               ROW_NUMBER() OVER (ORDER BY ARI.RowIndex)
        FROM STC.Outgoing St
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON St.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
            JOIN STC.StockDocumentType sdt
                ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            LEFT JOIN STC.OutgoingItem ARI
                ON St.OutgoingID = ARI.OutgoingID
            LEFT JOIN STF.Stuff s
                ON ARI.StuffID = s.StuffID
            LEFT JOIN STF.StuffDetail stfdtl
                ON ARI.StuffID = stfdtl.StuffID
            LEFT JOIN STF.StuffAccountGroup stfacc
                ON stfacc.StuffAccountGroupID = stfdtl.StuffAccountGroupID
            LEFT JOIN STF.StockDocumentTypeSlDl wip
                ON wip.StuffAccountGroupID = stfacc.StuffAccountGroupID
                   AND wip.StockDocumentTypeID = sdtb.StockDocumentTypeID
                   AND
                   (
                       wip.DlID IS NULL
                       OR wip.DlID = St.DeliverDlID
                   )
            join stf.stock stock 
                on St.StockID = stock.StockID
            join stf.StuffAccountGroupAccountSl sl 
                on sl.StuffAccountGroupID = stfacc.StuffAccountGroupID and stock.StockTypeID = sl.StockTypeID
        WHERE St.OutgoingID = @OutgoingID
              AND ARI.Price > 0
        ORDER BY ARI.RowIndex;
    END;

    IF EXISTS (SELECT ItemId FROM ##ARItems WHERE InventorySlID IS NULL)
    BEGIN
        SELECT @errorMessage = 'InventorySlNotSpecified';
        --SET @ErrorMessage = 'در برخي از گروه حسابها مقدار معين موجودي تعيين نشده است.'; 
        RETURN;
    END;


    IF EXISTS
    (
        SELECT ItemId
        FROM ##ARItems
        WHERE SlID IS NULL
              AND @OutgoingType <> 4
    )
    BEGIN

        DECLARE @StuffAccountGroup NVARCHAR(250);
        SELECT @StuffAccountGroup = StuffAccountGroup
        FROM ##ARItems
        WHERE SlID IS NULL;


        IF @SlBaseOnDl = 0
            SET @errorMessage
                = 'در گروه حساب ' + @StuffAccountGroup + ' برای حواله انبار از نوع ' + @StockDocumentType
                  + ' حساب معین مشخص نشده است.';
        IF @SlBaseOnDl = 1
            SET @errorMessage
                = 'در گروه حساب ' + @StuffAccountGroup + ' برای حواله انبار از نوع ' + @StockDocumentType + ' به ازای '
                  + @dlcode + ' حساب معین مشخص نشده است.';
        RETURN;
    END;


    INSERT INTO [STC].[OutgoingAccSetting]
    (
        [OutgoingItemID],
        [RowIndex],
        [IsDebit],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
    )
    SELECT [ItemId],
           RowNum,
           1,
           @CurrentUser,
           @CurrentDate,
           @CurrentUser,
           @CurrentDate,
           0
    FROM ##ARItems It;

    IF (@DeliverDlID IS NOT NULL)
    BEGIN
        INSERT INTO [STC].[OutgoingAccSettingAccountLevel]
        (
            [OutgoingAccSettingID],
            [AccountLevelID],
            [DlID],
            [Value],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            [Version]
        )
        SELECT oas.[OutgoingAccSettingID],
               als.AccountLevelID,
               @DeliverDlID,
               NULL,
               @CurrentUser,
               @CurrentDate,
               @CurrentUser,
               @CurrentDate,
               0
        FROM ##ARItems
            INNER JOIN [STC].[OutgoingAccSetting] oas
                ON oas.OutgoingItemID = ##ARItems.ItemId
            INNER JOIN ACC.AccountLevelSL als
                ON als.SlID = CASE
                                  WHEN @OutgoingType = 4 THEN
                                      @StockToStockSL
                                  ELSE
                                      ##ARItems.SlID
                              END
        WHERE als.DlTypeID = @DlTypeId
              AND oas.IsDebit = 1;
    END;

    INSERT INTO [STC].[OutgoingAccSettingAccountLevel]
    (
        [OutgoingAccSettingID],
        [AccountLevelID],
        [DlID],
        [Value],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
    )
    SELECT oas.[OutgoingAccSettingID],
           als.AccountLevelID,
           d.DlID,
           NULL,
           @CurrentUser,
           @CurrentDate,
           @CurrentUser,
           @CurrentDate,
           0
    FROM ##ARItems
        JOIN [STC].[OutgoingAccSetting] oas
            ON oas.OutgoingItemID = ##ARItems.ItemId
        JOIN ACC.AccountLevelSL als
            ON als.SlID = CASE
                              WHEN @OutgoingType = 4 THEN
                                  @StockToStockSL
                              ELSE
                                  ##ARItems.SlID
                          END
        JOIN STC.OutgoingDl d
            ON d.DlTypeID = als.DlTypeID
    WHERE d.OutgoingID = @OutgoingID
          AND oas.IsDebit = 1;


    DECLARE db_cursor CURSOR FOR
    SELECT TraceID,
           DlTypeID
    FROM STF.Trace
    WHERE DlTypeID IS NOT NULL;

    OPEN db_cursor;
    FETCH NEXT FROM db_cursor
    INTO @TRACEID,
         @DlType;

    WHILE @@FETCH_STATUS = 0
    BEGIN

        SET @Query
            = N'INSERT INTO [STC].[OutgoingAccSettingAccountLevel]
					   ([OutgoingAccSettingID]
					   ,[AccountLevelID]
					   ,[DlID]
					   ,[Value]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[Version])
	        SELECT oas.[OutgoingAccSettingID],
	               als.AccountLevelID,
	               a.' + QUOTENAME(@TRACEID)
              + N',
	               NULL,
	               @pCreatorId,
	               GETDATE(),
	               @pCreatorId,
	               GETDATE(),
	               0
	        FROM    ##ARItems a
			INNER JOIN [STC].[OutgoingAccSetting] oas on oas.OutgoingItemID = a.ItemId
	               INNER JOIN Acc.AccountLevelSL als
	                    ON  als.SlID =   case when @OutgoingType = 4 then @pStockToStockSL else a.SlID end
	        WHERE  als.DlTypeID = @pDlTypeId  and a.' + QUOTENAME(@TRACEID) + N' is not null and oas.IsDebit = 1';

        SET @QueryParam = N'@pCreatorId INT,@pDlTypeId INT,@pStockToStockSL int,@OutgoingType int';

        EXECUTE sp_executesql @Query,
                              @QueryParam,
                              @pCreatorId = @CurrentUser,
                              @pDlTypeId = @DlType,
                              @pStockToStockSL = @StockToStockSL,
                              @OutgoingType = @OutgoingType;

        FETCH NEXT FROM db_cursor
        INTO @TRACEID,
             @DlType;
    END;

    CLOSE db_cursor;
    DEALLOCATE db_cursor;


    SELECT @LastRowIndex = MAX(##ARItems.RowNum)
    FROM ##ARItems;

    UPDATE ##ARItems
    SET RowNum = @LastRowIndex + RowNum;

    INSERT INTO [STC].[OutgoingAccSetting]
    (
        [OutgoingItemID],
        [RowIndex],
        [IsDebit],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
    )
    SELECT [ItemId],
           RowNum,
           0,
           @CurrentUser,
           @CurrentDate,
           @CurrentUser,
           @CurrentDate,
           0
    FROM ##ARItems It;

    IF (@DeliverDlID IS NOT NULL)
    BEGIN
        INSERT INTO [STC].[OutgoingAccSettingAccountLevel]
        (
            [OutgoingAccSettingID],
            [AccountLevelID],
            [DlID],
            [Value],
            [Creator],
            [CreationDate],
            [LastEditor],
            [LastEditionDate],
            [Version]
        )
        SELECT oas.[OutgoingAccSettingID],
               als.AccountLevelID,
               @DeliverDlID,
               NULL,
               @CurrentUser,
               @CurrentDate,
               @CurrentUser,
               @CurrentDate,
               0
        FROM ##ARItems
            INNER JOIN [STC].[OutgoingAccSetting] oas
                ON oas.OutgoingItemID = ##ARItems.ItemId
            INNER JOIN ACC.AccountLevelSL als
                ON als.SlID = ##ARItems.InventorySlID
        WHERE als.DlTypeID = @DlTypeId
              AND oas.IsDebit = 0;
    END;

    INSERT INTO [STC].[OutgoingAccSettingAccountLevel]
    (
        [OutgoingAccSettingID],
        [AccountLevelID],
        [DlID],
        [Value],
        [Creator],
        [CreationDate],
        [LastEditor],
        [LastEditionDate],
        [Version]
    )
    SELECT oas.[OutgoingAccSettingID],
           als.AccountLevelID,
           d.DlID,
           NULL,
           @CurrentUser,
           @CurrentDate,
           @CurrentUser,
           @CurrentDate,
           0
    FROM ##ARItems
        JOIN [STC].[OutgoingAccSetting] oas
            ON oas.OutgoingItemID = ##ARItems.ItemId
        JOIN ACC.AccountLevelSL als
            ON als.SlID = ##ARItems.InventorySlID
        JOIN STC.OutgoingDl d
            ON d.DlTypeID = als.DlTypeID
    WHERE d.OutgoingID = @OutgoingID
          AND oas.IsDebit = 0;

    DECLARE db_cursor CURSOR FOR
    SELECT TraceID,
           DlTypeID
    FROM STF.Trace
    WHERE DlTypeID IS NOT NULL;

    OPEN db_cursor;
    FETCH NEXT FROM db_cursor
    INTO @TRACEID,
         @DlType;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @Query
            = N'INSERT INTO [STC].[OutgoingAccSettingAccountLevel]
					   ([OutgoingAccSettingID]
					   ,[AccountLevelID]
					   ,[DlID]
					   ,[Value]
					   ,[Creator]
					   ,[CreationDate]
					   ,[LastEditor]
					   ,[LastEditionDate]
					   ,[Version])
	        SELECT oas.[OutgoingAccSettingID],
	               als.AccountLevelID,
	               a.' + QUOTENAME(@TRACEID)
              + N',
	               NULL,
	               @pCreatorId,
	               GETDATE(),
	               @pCreatorId,
	               GETDATE(),
	               0
	        FROM    ##ARItems a
			INNER JOIN [STC].[OutgoingAccSetting] oas on oas.OutgoingItemID = a.ItemId
	               INNER JOIN Acc.AccountLevelSL als
	                    ON  als.SlID =  a.InventorySlID
	        WHERE  als.DlTypeID = @pDlTypeId and a.' + QUOTENAME(@TRACEID) + N' is not null and oas.IsDebit = 0';

        SET @QueryParam = N'@pCreatorId INT,@pDlTypeId INT';

        EXECUTE sp_executesql @Query,
                              @QueryParam,
                              @pCreatorId = @CurrentUser,
                              @pDlTypeId = @DlType;

        FETCH NEXT FROM db_cursor
        INTO @TRACEID,
             @DlType;
    END;

    CLOSE db_cursor;
    DEALLOCATE db_cursor;

    DROP TABLE ##ARItems;
END;


