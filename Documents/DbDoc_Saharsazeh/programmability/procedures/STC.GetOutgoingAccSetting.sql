---------------------------------------------------------------------------------------------------------
CREATE   PROC [STC].[GetOutgoingAccSetting] (@OutgoingID INT)
--WITH ENCRYPTION
AS 
BEGIN
    DROP TABLE IF EXISTS ##ARItems;
			   
    DECLARE @Columns NVARCHAR(MAX),
            @ColumnsInALTERTable NVARCHAR(MAX),
            @ColumnsInSelectList NVARCHAR(MAX),
            @Query NVARCHAR(MAX),
            @QueryParam NVARCHAR(MAX),
            @StockToStockSL INT,
            @OutgoingType INT;

    SELECT @StockToStockSL = ConfigValue
    FROM CFG.Configuration
    WHERE ConfigKey = 'StockToStockSL';
	
    SELECT @OutgoingType = sdt.DocumentType
    FROM STC.Outgoing AS SRTable
    JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON SRTable.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
        INNER JOIN STC.StockDocumentType sdt
            ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
    WHERE SRTable.OutgoingID = @OutgoingID;

    IF EXISTS (SELECT TraceID FROM STF.Trace WHERE DlTypeID IS NOT NULL)
    BEGIN

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
        '' );

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
			price	decimal(30,4),
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
			price,
	        InventorySlID,
	        SlID,
			StuffAccountGroup,
	        RowNum, ' + @Columns
              + N'
	      )
	    SELECT ARI.OutgoingItemID,
				ARI.Price,
	           sagas.InventorySlID,
	            case when @pOutgoingType = 4 then @StockToStockSL else wip.slid end,
			   stfacc.Title,
	           ARI.RowIndex,' + @Columns
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
			   left join stf.StuffAccountGroupAccountSl sagas on stfacc.StuffAccountGroupID = sagas.StuffAccountGroupID and stk.StockTypeID = sagas.StockTypeID
	           left join stf.StockDocumentTypeSlDl wip on wip.StuffAccountGroupID = stfacc.StuffAccountGroupID 
														and wip.StockDocumentTypeID = sdtb.StockDocumentTypeID
														and (wip.dlid is null or wip.DlID = st.DeliverDlID)
	    WHERE  St.OutgoingID = @pOutgoingID	     --	     and ARI.price > 0
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
            price DECIMAL(30, 4),
            InventorySlID INT,
            SlID INT,
            StuffAccountGroup NVARCHAR(250),
            RowNum INT
        );

        INSERT INTO ##ARItems
        (
            ItemId,
            price,
            InventorySlID,
            SlID,
            StuffAccountGroup,
            RowNum
        )
        SELECT ARI.OutgoingItemID,
               ARI.Price,
               sl.InventorySlID,
               CASE
                   WHEN @OutgoingType = 4 THEN
                       @StockToStockSL
                   ELSE
                       wip.SlID
               END,
               stfacc.Title,
               ARI.RowIndex
        FROM STC.Outgoing St
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON st.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
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
        WHERE St.OutgoingID = @OutgoingID --     and ARI.price > 0
        ORDER BY ARI.RowIndex;
    END;

    SELECT a.OutgoingAccSettingID,
           a.OutgoingItemID,
           b.RowIndex ItemRowIndex,
           a.RowIndex,
           a.IsDebit,
           vw.slid AS SlID,
           vw.SlCode,
           vw.SlTitle,
           ##ARItems.price Debit,
           0 Credit,
           a.[Version],
           a.Creator,
           a.CreationDate
    FROM [STC].[OutgoingAccSetting] a
        JOIN STC.OutgoingItem b
            ON a.OutgoingItemID = b.OutgoingItemID
        JOIN ##ARItems
            ON ##ARItems.ItemId = b.OutgoingItemID
        JOIN ACC.vwaccounts vw
            ON vw.slid = ##ARItems.SlID
    WHERE OutgoingID = @OutgoingID
          AND a.IsDebit = 1
    UNION ALL
    SELECT a.OutgoingAccSettingID,
           a.OutgoingItemID,
           b.RowIndex ItemRowIndex,
           a.RowIndex,
           a.IsDebit,
           vw.slid AS SlID,
           vw.SlCode,
           vw.SlTitle,
           0 Debit,
           ##ARItems.price Credit,
           a.[Version],
           a.Creator,
           a.CreationDate
    FROM [STC].[OutgoingAccSetting] a
        JOIN STC.OutgoingItem b
            ON a.OutgoingItemID = b.OutgoingItemID
        JOIN ##ARItems
            ON ##ARItems.ItemId = b.OutgoingItemID
        JOIN ACC.vwaccounts vw
            ON vw.slid = ##ARItems.InventorySlID
    WHERE OutgoingID = @OutgoingID
          AND a.IsDebit = 0;
		  
    SELECT c.OutgoingAccSettingAccountLevelID,
           a.OutgoingAccSettingID,
           c.AccountLevelID,
           DL.DLID AS DlID,
           c.Value,
           DL.Code DLCode
    FROM [STC].[OutgoingAccSettingAccountLevel] c
        JOIN [STC].[OutgoingAccSetting] a
            ON c.OutgoingAccSettingID = a.OutgoingAccSettingID
        JOIN STC.OutgoingItem b
            ON a.OutgoingItemID = b.OutgoingItemID
        LEFT JOIN ACC.DL
            ON DL.DLID = c.DlID
    WHERE OutgoingID = @OutgoingID;

    DROP TABLE IF EXISTS ##ARItems;
END;
