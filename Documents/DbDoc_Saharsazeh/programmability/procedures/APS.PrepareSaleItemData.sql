
------------------------------------------------
CREATE   PROCEDURE [APS].PrepareSaleItemData
AS
BEGIN
	TRUNCATE TABLE MDT.DmdSaleItem;

	DECLARE @Q VARCHAR(MAX);
	SET @Q = 'INSERT INTO MDT.DmdSaleItem';


	PRINT SYSDATETIME();
	SELECT @Q
		= @Q + ' SELECT ' + sti.TableName + 'ID, ' + sti.ItemType + ', ' + sti.ParentTableName + 'ID FROM   '
		  + sti.[Scheme] + '.[' + sti.TableName + '] AS ri UNION '
	FROM MDT.SaleTableItem AS sti;
	SET @Q = SUBSTRING(@Q, 1, LEN(@Q) - 5);

	EXEC (@Q);
	PRINT SYSDATETIME();

	DELETE dsi
	FROM MDT.DmdSaleItem AS dsi
		INNER JOIN SLE.InvoiceItem AS ii
			ON ii.InvoiceItemID = dsi.ID
		INNER JOIN SLE.Invoice AS i
			ON i.InvoiceID = ii.InvoiceID
	WHERE dsi.ItemType = 5
		  AND i.[SaleInvoiceStatus] = 5;

	DELETE dsi
	FROM MDT.DmdSaleItem AS dsi
		INNER JOIN STC.OutgoingItem AS ii
			ON ii.OutgoingItemID = dsi.ID
		INNER JOIN STC.Outgoing AS i
			ON i.OutgoingID = ii.OutgoingID
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
			ON i.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
	WHERE dsi.ItemType = 6
		  AND NOT EXISTS
	(
		SELECT StockDocumentTypeID
		FROM STC.StockDocumentType b
		WHERE b.[Type] = 2
			  AND b.DocumentType IN ( 1, 10 )
			  AND b.StockDocumentTypeID = sdtb.StockDocumentTypeID
	);

	PRINT SYSDATETIME();

	TRUNCATE TABLE MDT.DmdSaleItemConnection;
	TRUNCATE TABLE APS.FactSaleItem;
	TRUNCATE TABLE APS.DimSaleItem;

	PRINT SYSDATETIME();

	INSERT INTO APS.DimSaleItem
	(
		Id,
		ItemId,
		ItemType,
		HeaderID
	)
	SELECT ItemType * 10000000000 + Id,
		   Id,
		   ItemType,
		   si.HeaderID
	FROM MDT.DmdSaleItem AS si;

	PRINT SYSDATETIME();


	SET @Q = 'INSERT INTO MDT.DmdSaleItemConnection
		  (
			FromID,
			ToID,
			ParentId,
			ChildId
		  )';

	SELECT @Q
		= @Q
		  + 'SELECT si2.NodeID,
				   si.NodeID,
				   si.ItemType * 10000000000 + si.Id,
				   si2.ItemType * 10000000000 + si2.Id
			FROM   MDT.DmdSaleItem AS si 
				   INNER JOIN ' + sti.[Scheme] + '.' + sti.TableName + '  AS b ON  si.ID = b.' + sti.TableName
		  + 'ID AND si.ItemType = ' + sti.ItemType + ' INNER JOIN ' + sti2.[Scheme] + '.' + sti2.TableName
		  + ' AS c ON  c.' + sti.TableName + 'ID = b.' + sti.TableName
		  + 'ID INNER JOIN MDT.DmdSaleItem AS si2 ON  si2.ID = c.' + sti2.TableName + 'ID AND si2.ItemType = '
		  + sti2.ItemType + ' UNION '
	FROM MDT.SaleTableItemRelation AS stir
		INNER JOIN MDT.SaleTableItem AS sti
			ON stir.ParentId = sti.ItemType
		INNER JOIN MDT.SaleTableItem AS sti2
			ON stir.ChildId = sti2.ItemType;

	SET @Q = SUBSTRING(@Q, 1, LEN(@Q) - 5);
	EXEC (@Q);
	---------------------------

	SET @Q = 'INSERT INTO Aps.DimSaleItemTrace
			(
				DimSaleItemId,
				TraceID,
				DlID,
				[Value]
			)';

	SELECT @Q
		= @Q + ' SELECT  dsi.Id,oit.TraceID,dsi.DlID,oit.[Value] FROM APS.DimSaleItem AS dsi INNER JOIN '
		  + sti.[Scheme] + '.' + sti.TableName + ' AS oi ON oi.' + sti.TableName + 'ID=dsi.ItemId AND dsi.ItemType='
		  + sti.ItemType + ' INNER JOIN ' + sti.[Scheme] + '.' + sti.TableName + 'Trace AS oit ON oit.' + sti.TableName
		  + 'ID = oi.' + sti.TableName + 'ID UNION '
	FROM MDT.SaleTableItem sti;

	SET @Q = SUBSTRING(@Q, 1, LEN(@Q) - 5);


	EXEC (@Q);

	SET @Q = '';

	SELECT @Q
		= @Q +  ' UPDATE APS.DimSaleItem
				SET 
					ParentID=item.' + REPLACE(sti.TableName, 'Item', '')
		  + 'ID,
					StuffID = item.StuffID,
					ItemRowIndex=item.RowIndex,
					FinancialPeriodID = p.FinancialPeriodID,
				' + CASE
						WHEN sti.StatusColumn IS NULL THEN
							''
						ELSE
							'[Status] = p.' + sti.StatusColumn + ','
					END + ' Number = p.Number, ' + CASE
													   WHEN sti.SaleTypeColumn IS NULL THEN
														   ''
													   ELSE
														   'SaleTypeID = p.SaleTypeID,'
												   END +
												   CASE
													   WHEN sti.SaleModelColumn IS NULL THEN
														   ''
													   ELSE
														   'SaleModel = item.SaleModelID,'
												   END + CASE
															 WHEN sti.SaleAreaColumn IS NULL THEN
																 ''
															 ELSE
																 'SaleAreaID = p.SaleAreaID,'
														 END + ' Date = p.[Date] , DLID = '
		  + CASE
				WHEN sti.PartyColumn IS NULL THEN
					'p.' + sti.DlColumn
				ELSE
					' (SELECT p2.DlID FROM cfg.Party AS p2 WHERE p2.PartyID=p.' + sti.PartyColumn + ')'
			END + ', BranchID = ' + CASE
										WHEN sti.BranchColumn = 'BranchID' THEN
											'p.BranchID'
										ELSE
											'(SELECT s1.BranchID FROM Stf.Stock AS s1 WHERE s1.StockID=p.StockID)'
									END + ' FROM APS.DimSaleItem
INNER JOIN '    + sti.[Scheme] + '.' + sti.TableName + ' AS item ON item.' + sti.TableName
		  + 'ID= APS.DimSaleItem.ItemId AND APS.DimSaleItem.ItemType=' + sti.ItemType + ' INNER JOIN ' + sti.[Scheme]
		  + '.[' + sti.[ParentTableName] + '] AS p ON p.' + sti.[ParentTableName] + 'ID = item.'
		  + sti.[ParentTableName] + 'ID'
	FROM MDT.SaleTableItem AS sti;
	

	EXEC (@Q);

	PRINT SYSDATETIME();

	UPDATE APS.DimSaleItem
	SET DocumentID = ItemType * 10000000000 + ParentID
	WHERE 1 = 1;

	IF OBJECT_ID('tempdb..#T') IS NOT NULL
		DROP TABLE #T;

	WITH ROOT
	AS (SELECT FromID AS childId,
			   ToID AS ParentId,
			   ChildID AS ChildId0,
			   ParentID AS ParentId0
		FROM MDT.DmdSaleItemConnection AS dsic
		UNION ALL
		SELECT FromID,
			   ToID,
			   MDT.DmdSaleItemConnection.ChildID AS ChildId0,
			   ROOT.ParentId0 AS ParentId0
		FROM [ROOT]
			INNER JOIN MDT.DmdSaleItemConnection
				ON MDT.DmdSaleItemConnection.ToID = ROOT.childId)
	SELECT ChildId0 AS Id,
		   ParentId0 AS ParentId
	INTO #T
	FROM ROOT;

	TRUNCATE TABLE APS.FactSaleItem;
	
	INSERT INTO APS.FactSaleItem
	(
		ParentId,
		ChildId,
		MainQuantity,
		SubQuantity,
		BaseMainQuantity,
		BaseSubQuantity
	)
	SELECT ParentId,
		   Id,
		   0,
		   0,
		   0,
		   0
	FROM #T;

	---------------------------------------------------------------------------------
	CREATE TABLE #TwoWayItems
	(
		Id1 INT NOT NULL,
		id2 INT NOT NULL
	);

	INSERT INTO #TwoWayItems
	(
		Id1,
		id2
	)
	SELECT 5,
		   6
	UNION
	SELECT 5,
		   4;

	INSERT INTO APS.FactSaleItem
	(
		ParentId,
		ChildId,
		MainQuantity,
		SubQuantity,
		BaseMainQuantity,
		BaseSubQuantity
	)
	SELECT p.Id,
		   p.ParentId,
		   0,
		   0,
		   0,
		   0
	FROM #T p
		INNER JOIN APS.DimSaleItem AS dsiChild
			ON dsiChild.Id = p.Id
		INNER JOIN APS.DimSaleItem AS dsiParent
			ON dsiParent.Id = p.ParentId
		INNER JOIN #TwoWayItems a
			ON a.Id1 = dsiChild.ItemType
			   AND a.id2 = dsiParent.ItemType;

	INSERT INTO APS.FactSaleItem
	(
		ParentId,
		ChildId,
		MainQuantity,
		SubQuantity,
		BaseMainQuantity,
		BaseSubQuantity
	)
	SELECT p.Id,
		   p.ParentId,
		   0,
		   0,
		   0,
		   0
	FROM #T p
		INNER JOIN APS.DimSaleItem AS dsiChild
			ON dsiChild.Id = p.Id
		INNER JOIN APS.DimSaleItem AS dsiParent
			ON dsiParent.Id = p.ParentId
		INNER JOIN #TwoWayItems a
			ON a.id2 = dsiChild.ItemType
			   AND a.Id1 = dsiParent.ItemType;
	----------------------------------------------------------------------------------
	PRINT SYSDATETIME();
	INSERT INTO APS.FactSaleItem
	(
		ParentId,
		ChildId,
		MainQuantity,
		SubQuantity,
		BaseMainQuantity,
		BaseSubQuantity
	)
	SELECT dsi.Id,
		   NULL,
		   0,
		   0,
		   0,
		   0
	FROM APS.DimSaleItem AS dsi
		LEFT JOIN APS.FactSaleItem AS fsi
			ON fsi.ParentId = dsi.Id
	WHERE fsi.Id IS NULL;

	SET @Q = '';
	SELECT @Q
		= @Q
		  + 'UPDATE aps.FactSaleItem
			SET MainQuantity = ii.MainQuantity,
				SubQuantity = ii.SubQuantity
			FROM aps.FactSaleItem
			INNER JOIN APS.DimSaleItem AS dsi ON dsi.Id = aps.FactSaleItem.ChildId
			INNER JOIN ' + sti.[Scheme] + '.' + sti.TableName + ' AS ii ON ii.' + sti.TableName
		  + 'ID=dsi.ItemId AND dsi.ItemType=' + sti.ItemType
	FROM MDT.SaleTableItem AS sti;

	EXEC (@Q);
	
	SELECT @Q
		= @Q
		  + 'UPDATE aps.FactSaleItem
			SET BaseMainQuantity = ii.MainQuantity,
				BaseSubQuantity = ii.SubQuantity
			FROM aps.FactSaleItem
			INNER JOIN APS.DimSaleItem AS dsi ON dsi.Id = aps.FactSaleItem.ParentID
			INNER JOIN ' + sti.[Scheme] + '.' + sti.TableName + ' AS ii ON ii.' + sti.TableName
		  + 'ID=dsi.ItemId AND dsi.ItemType=' + sti.ItemType
	FROM MDT.SaleTableItem AS sti;

	EXEC (@Q);
END;
