
CREATE   PROCEDURE [STC].spOutgoingPreVoucherInsert
	@OutgoingId NVARCHAR(MAX)
--WITH ENCRYPTION 
AS

	        
	DECLARE @DocumentNumTypeId INT = (		
								SELECT  DNT.DocumentNumTypeID
								FROM   CFG.DocumentNumType DNT
								WHERE  DNT.EngName = 'Outgoing'),
			@MDEntity INT = (select Top 1 Id from mdt.DmdEntity where Name = 'Outgoing'),
			@TRACEID INT,
			@DlType int,
			@MaxPrevoucherID int,
			@creatorId INT ,
			@Culture VARCHAR(10),
			@CultureNo TinyInt,
			@HeaderDescription  nvarchar(max),
			@HeaderDescription2 nvarchar(max),
			@InventoryDescription  nvarchar(max),
			@InventoryDescription2  nvarchar(max),
			@CostDescription nvarchar(max),
			@CostDescription2 nvarchar(max)

		set @creatorId = cfg.GetuserID();
		SET @Culture = CFG.GetuserCulture()
		SELECT @CultureNo = CultureNo
		FROM cfg.CultureInfo
		WHERE Culture = @Culture

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@OutgoingId) 

		SELECT  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		FROM CFG.[VoucherDescription] 
		WHERE MDEntityID = @MDEntity AND [Key] = 'Header'


		SELECT  @InventoryDescription = Description,
				@InventoryDescription2 = Description2
		FROM CFG.[VoucherDescription] 
		WHERE MDEntityID = @MDEntity AND [Key] = 'Inventory'

		SELECT  @CostDescription = Description,
				@CostDescription2 = Description2
		FROM CFG.[VoucherDescription] 
		WHERE MDEntityID = @MDEntity AND [Key] = 'Cost'
		
		 --- FetchValues ---
		SELECT @MaxPrevoucherID = MAX(PreVoucherID)
		FROM acc.PreVoucher

		SELECT 
				ISNULL(@MaxPrevoucherID,0) + ROW_NUMBER() OVER(ORDER BY SRTable.OutgoingID) PrevoucherID,
				SRTable.OutgoingID,
				SRTable.DeliverDlID,
				St.BranchID,
				sdt.DocumentType,
				SRTable.FinancialPeriodID,
				SRTable.Number ,
				SRTable.TotalPrice,
				SRTable.Date,
				sdt.Title,
				sdt.SlBaseOnDl,
				@HeaderDescription [Description],
				@HeaderDescription2 [Description2],
				FullDateAlternateKey,
				PersianFullDateAlternateKey,
				CAST(NULL AS VARCHAR(MAX)) ErrorMessage,
				sdt.StockDocumentTypeID,
				CASE WHEN @CultureNo = 1 THEN sdt.Title ELSE sdt.Title2 END StockDocumentType,
				dl.Code DlCode,
				st.StockTypeID,
				dst.StockTypeID DestinationStockTypeID,
				sdt.Title AS OutgoingType,
				sdt.Title2 AS OutgoingType2,
				st.Title AS StockName,
				st.Title2 AS StockName2,
				dl.Title AS Recipient,
				dl.Title2 AS Recipient2
			into #Outgoing
	    FROM   stc.Outgoing  AS SRTable
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON SRTable.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		JOIN #DocumentIds on #DocumentIds.ID = SRTable.OutgoingID
	    INNER JOIN stf.Stock AS St ON  SRTable.StockID = St.StockID
		inner join stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
	    JOIN cfg.DimDate DD on DD.Date = SRTable.Date
		left join acc.dl on dl.DLID = SRTable.DeliverDlID
		left JOIN stf.Stock AS dSt ON  SRTable.DeliverStockID = dSt.StockID
		where PreVoucherID is null

		DECLARE @TranslationBetweenStocksHasAccountingVoucher VARCHAR(300);
		SELECT TOP 1 @TranslationBetweenStocksHasAccountingVoucher = sc.ConfigValue
		FROM   CFG.Configuration sc
		WHERE  sc.ConfigKey = 'TranslationBetweenStocksHasAccountingVoucher';


		 IF LOWER(@TranslationBetweenStocksHasAccountingVoucher)= 'false'
		 BEGIN
			update #Outgoing 
			set ErrorMessage = N'STC_spOutgoingPreVoucherInsert_2^'+CAST(Number as varchar(10))
			where DocumentType = 4 
			and StockTypeID = DestinationStockTypeID

			if exists (select * from #Outgoing where ErrorMessage is not null )
			BEGIN	
				select OutgoingID,ErrorMessage from #Outgoing
				RETURN;
			END
		 END


	    create TABLE #TempOfOutgoingItems
	    (
	    	OutgoingItemID		INT,
			OutgoingID			INT,
			PreVoucherID		INT,
	    	Price				DECIMAL(18, 4),
	    	Fee					DECIMAL(18, 4),
	    	InventorySlID       INT,
	    	SlID				INT,
			StuffDetailType		INT,
			StuffAccountGroup	NVARCHAR(250),
			InventoryDescription			NVARCHAR(MAX),
			InventoryDescription2			NVARCHAR(MAX),
			CostDescription			NVARCHAR(MAX),
			CostDescription2			NVARCHAR(MAX),
			ItemDescription				NVARCHAR(MAX),
			ItemDescription2			NVARCHAR(MAX)
	    )


	    IF EXISTS (SELECT TRACEID FROM STF.Trace WHERE DlTypeID IS NOT NULL)
	    BEGIN
	 
	    DECLARE @Columns NVARCHAR(MAX),
				@ColumnsInALTERTable NVARCHAR(MAX),
				@ColumnsInSelectList NVARCHAR(MAX),
				@Query NVARCHAR(MAX),
				@QueryParam NVARCHAR(MAX);

		select @ColumnsInALTERTable = STUFF((SELECT distinct ' alter TABLE #TempOfOutgoingItems add ' + QUOTENAME(TraceID) +' INT'
								FROM STF.Trace WHERE DlTypeID IS NOT NULL
								FOR XML PATH(''), TYPE
							   ).value('.', 'NVARCHAR(MAX)'),1,1,'')
							   
		if @ColumnsInALTERTable is not null
			exec(@ColumnsInALTERTable);

		select @Columns = STUFF((SELECT distinct ',' + QUOTENAME(TraceID)
								FROM STF.Trace WHERE DlTypeID IS NOT NULL
								FOR XML PATH(''), TYPE
							   ).value('.', 'NVARCHAR(MAX)'),1,1,'')

	    
		 set @Query = N'INSERT INTO #TempOfOutgoingItems
	      (
			OutgoingItemID,
			OutgoingID,
			PreVoucherID,
	        Price,
	        Fee,
	        InventorySlID,
	        SlID,
			StuffDetailType,
			StuffAccountGroup,
			InventoryDescription,
			InventoryDescription2,
			CostDescription,
			CostDescription2, 
			ItemDescription,
			ItemDescription2,
			'+@Columns+'
	      )
	    SELECT  
				ARI.OutgoingItemID,
				st.OutgoingID,
				st.PreVoucherID,
	            ARI.Price,
	            ARI.Fee,
	            sagas.InventorySlID,
	            wip.SlID,
			    stfacc.StuffDetailType,
			    case when @CultureNo = 1 then stfacc.Title else  stfacc.Title2 end,
				REPLACE(@InventoryDescription, ''@@StuffTitle@@'', stfdtl.Title),
				REPLACE(@InventoryDescription2, ''@@StuffTitle@@'', stfdtl.Title2),
				REPLACE(@CostDescription, ''@@StuffTitle@@'', stfdtl.Title),
				REPLACE(@CostDescription2, ''@@StuffTitle@@'', stfdtl.Title2),
				ARI.Description AS ItemDescription,
				ARI.Description2 AS ItemDescription2,
				'+@Columns+'	           
	    FROM   #Outgoing St
	           LEFT JOIN stc.OutgoingItem ARI   ON  St.OutgoingID = ARI.OutgoingID
	           LEFT JOIN(select OutgoingItemID,TraceID,DLID
	           			 from stc.OutgoingItemTrace 
	                     WHERE DLID IS NOT NULL ) x
				pivot 
				(
						max(DLID)
					for TraceID in ( ' + @Columns + ')
				) p  on ARI.OutgoingItemID = p.OutgoingItemID
	           LEFT JOIN stf.vwStuff stfdtl ON  ARI.StuffID = stfdtl.StuffID
	           LEFT JOIN stf.StuffAccountGroup stfacc ON  stfacc.StuffAccountGroupID = stfdtl.StuffAccountGroupID
			   LEFT JOIN stf.StuffAccountGroupAccountSl sagas ON st.StockTypeID = sagas.StockTypeID 
															  and sagas.StuffAccountGroupID = stfacc.StuffAccountGroupID
	           LEFT JOIN stf.StockDocumentTypeSlDl wip on wip.StuffAccountGroupID = stfacc.StuffAccountGroupID 
														and wip.StockDocumentTypeID = st.StockDocumentTypeID
														and (wip.dlid is null or wip.DlID = st.DeliverDlID)
	    ORDER BY  ARI.RowIndex'
	    SET @QueryParam =N' @CultureNo TINYINT,
							@InventoryDescription  nvarchar(max),
							@InventoryDescription2  nvarchar(max),
							@CostDescription nvarchar(max),
							@CostDescription2 nvarchar(max)		'
	   	EXECUTE sp_executeSQL     
			@Query,
			@QueryParam,
			@CultureNo = @CultureNo   ,
			@InventoryDescription = @InventoryDescription,
			@InventoryDescription2 = @InventoryDescription2,
			@CostDescription = @CostDescription,
			@CostDescription2 = @CostDescription2
	    
	    	   
	    END
	    ELSE
	    BEGIN

	    INSERT INTO #TempOfOutgoingItems
	      (
	        OutgoingItemID,
			OutgoingID,
			PreVoucherID,
	        Price,
	        Fee,
	        InventorySlID,
	        SlID,
			StuffDetailType,
			StuffAccountGroup,
			InventoryDescription,
			InventoryDescription2,
			CostDescription,
			CostDescription2,
			ItemDescription,
			ItemDescription2
	      )
	    SELECT 
			   ARI.OutgoingItemID,
			   st.OutgoingID,
			   st.PreVoucherID,
	           ARI.Price,
	           ARI.Fee,
	           sagas.InventorySlID,
	           wip.slid,
			   stfdtl.StuffDetailType,
			   case when @CultureNo = 1 then stfacc.Title else  stfacc.Title2 end ,
			   REPLACE(@InventoryDescription, '@@StuffTitle@@', stfdtl.Title),
			   REPLACE(@InventoryDescription2, '@@StuffTitle@@', stfdtl.Title2),
			   REPLACE(@CostDescription, '@@StuffTitle@@', stfdtl.Title),
			   REPLACE(@CostDescription2, '@@StuffTitle@@', stfdtl.Title2),
			   ARI.Description AS ItemDescription,
			   ARI.Description2 AS ItemDescription2
	    FROM   #Outgoing St
			   join stc.StockDocumentType sdt on sdt.StockDocumentTypeID = st.StockDocumentTypeID
	           LEFT JOIN stc.OutgoingItem ARI   ON  St.OutgoingID = ARI.OutgoingID
	           LEFT JOIN stf.vwStuff stfdtl ON  ARI.StuffID = stfdtl.StuffID
	           LEFT JOIN stf.StuffAccountGroup stfacc ON  stfacc.StuffAccountGroupID = stfdtl.StuffAccountGroupID
			   LEFT JOIN stf.StuffAccountGroupAccountSl sagas ON st.StockTypeID = sagas.StockTypeID 
															  and sagas.StuffAccountGroupID = stfacc.StuffAccountGroupID
	           LEFT JOIN stf.StockDocumentTypeSlDl wip on wip.StuffAccountGroupID = stfacc.StuffAccountGroupID 
														and wip.StockDocumentTypeID = st.StockDocumentTypeID
														and (wip.dlid is null or wip.DlID = st.DeliverDlID)
	    ORDER BY  ARI.RowIndex
	    END
	  

		update a 
		set ErrorMessage = N'STC_spOutgoingPreVoucherInsert_3^'+cast(Number as varchar(10))+char(10)+char(13)
		from #Outgoing a
		join #TempOfOutgoingItems b on a.OutgoingID = b.OutgoingID
		where Fee = 0 and StuffDetailType <> 3

		update a 
		set ErrorMessage = isnull(ErrorMessage,'') + N'InventorySlNotSpecified'+char(10)+char(13)
		from #Outgoing a
		join #TempOfOutgoingItems b on a.OutgoingID = b.OutgoingID
		where InventorySlID IS NULL

		update a 
		set ErrorMessage = isnull(ErrorMessage,'') + case when SlBaseOnDl = 0 then N'StockManager.Messages.SlNotSpecifiedForTheOutgoingTypeInTheStuffGroup^' + StuffAccountGroup+',' + StockDocumentType
								else N'StockManager.Messages.SlNotSpecifiedForTheOutgoingTypeForTheDlInTheStuffGroup^' + StuffAccountGroup +','+ StockDocumentType +','+ dlcode
								end+char(10)+char(13)
		from #Outgoing a
		join #TempOfOutgoingItems b on a.OutgoingID = b.OutgoingID
		where SlID IS NULL 

		if exists (select * from #Outgoing where ErrorMessage is not null )
		BEGIN	
			select OutgoingID,ErrorMessage from #Outgoing
			RETURN;
		END

		SET IDENTITY_INSERT [ACC].[PreVoucher] ON
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchId,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #Outgoing
		SET IDENTITY_INSERT [ACC].[PreVoucher] OFF

	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from stc.Outgoing a
		join #Outgoing b on a.OutgoingID = b.OutgoingID

	    INSERT INTO ACC.PreVoucherItem
	          ( PreVoucherID,
	            RowIndex,
	            SlID,
	            DESCRIPTION,
	            Description2,
	            Debit,
	            Credit,
	            CurrencyID,
	            CurrencyRate,
	            CurrencyDebit,
	            CurrencyCredit,
	            IsAutoGenerated,
	            Creator,
	            CreationDate,
	            LastEditor,
	            LastEditionDate,
				Version,
				BaseDocumentName,
				BaseDocumentID
	          )
	        SELECT PreVoucherId,
	               1,
	               it.SlID ,
	               CostDescription,
	               CostDescription2,
	               it.Price,
	               0,
	               -1,
	               1,
	               it.Price,
	               0,
	               1,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
				   0,
				   'OutgoingItem',
				   OutgoingItemID
	        FROM   #TempOfOutgoingItems It
		
			    -- Insert Inventory
	    INSERT INTO ACC.PreVoucherItem
	          ( PreVoucherID,
	            RowIndex,
	            SlID,
	            DESCRIPTION,
	            Description2,
	            Debit,
	            Credit,
	            CurrencyID,
	            CurrencyRate,
	            CurrencyDebit,
	            CurrencyCredit,
	            IsAutoGenerated,
	            Creator,
	            CreationDate,
	            LastEditor,
	            LastEditionDate,
	            Version,
				BaseDocumentName,
				BaseDocumentID
	          )
	        SELECT PreVoucherId,
	               1,
	               it.InventorySlID,
	               InventoryDescription,
	               InventoryDescription2,
	               0,
	               it.Price,
	               -1,
	               1,
	               0,
	               it.Price,	 
	               1,              
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0,
				   'OutgoingItem',
				   OutgoingItemID
	        FROM   #TempOfOutgoingItems It
			

	      INSERT INTO Acc.PreVoucherItemAccountLevel
	          (
	            PreVoucherItemID,
	            AccountLevelID,
	            DLID,
	            [Value],
	            Creator,
	            CreationDate,
	            LastEditor,
	            LastEditionDate,
	            Version
	          )
	        SELECT 
					a.PreVoucherItemID,
	               AccountLevelID,
	               oasal.dlid,
	               oasal.Value,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0
		from #TempOfOutgoingItems
		join acc.PreVoucherItem a on a.BaseDocumentName = 'OutgoingItem' and a.BaseDocumentID = #TempOfOutgoingItems.OutgoingItemID and Debit > 0
		join stc.OutgoingAccSetting b on b.OutgoingItemID = #TempOfOutgoingItems.OutgoingItemID
		join [STC].[OutgoingAccSettingAccountLevel] oasal on oasal.OutgoingAccSettingID = b.OutgoingAccSettingID
		where b.IsDebit = 1

	      INSERT INTO Acc.PreVoucherItemAccountLevel
	          (
	            PreVoucherItemID,
	            AccountLevelID,
	            DLID,
	            [Value],
	            Creator,
	            CreationDate,
	            LastEditor,
	            LastEditionDate,
	            Version
	          )
	        SELECT a.PreVoucherItemID,
	               AccountLevelID,
	               oasal.dlid,
	               oasal.Value,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0
		from #TempOfOutgoingItems
		join acc.PreVoucherItem a on a.BaseDocumentName = 'OutgoingItem' and a.BaseDocumentID = #TempOfOutgoingItems.OutgoingItemID and Credit > 0
		join stc.OutgoingAccSetting b on b.OutgoingItemID = #TempOfOutgoingItems.OutgoingItemID
		join [STC].[OutgoingAccSettingAccountLevel] oasal on oasal.OutgoingAccSettingID = b.OutgoingAccSettingID
		where b.IsDebit = 0

	      INSERT INTO Acc.PreVoucherItemAccountLevel
	          (
	            PreVoucherItemID,
	            AccountLevelID,
	            DLID,
	            [Value],
	            Creator,
	            CreationDate,
	            LastEditor,
	            LastEditionDate,
	            Version
	          )
	    SELECT  a.PreVoucherItemID,
	            b.AccountLevelID,
	            DeliverDlID,
	            NULL,
	            @creatorId,
	            GETDATE(),
	            @creatorId,
	            GETDATE(),
	            0
		 from #Outgoing h
		 join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
		 join acc.accountlevelsl b on a.slid = b.slid 
		 join acc.dl c on c.DLID = h.DeliverDlID and c.DlTypeID = b.DlTypeID
		 left join acc.PreVoucherItemAccountLevel pval on pval.PreVoucherItemID = a.PreVoucherItemID and pval.AccountLevelID = b.AccountLevelID
		 where pval.PreVoucherItemAccountLevelID is null

		  INSERT INTO Acc.PreVoucherItemAccountLevel
			(
			PreVoucherItemID,
			AccountLevelID,
			DLID,
			[Value],
			Creator,
			CreationDate,
			LastEditor,
			LastEditionDate,
			Version
			)
		SELECT 
			a.PreVoucherItemID,
			b.AccountLevelID,
			c.DlID,
			NULL,
			@creatorId,
			GETDATE(),
			@creatorId,
			GETDATE(),
			0
			from #Outgoing h
			join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
			join acc.accountlevelsl b on a.slid = b.slid 
			join stc.OutgoingDl c on c.OutgoingID = h.OutgoingID and c.DlTypeID = b.DlTypeID
		 left join acc.PreVoucherItemAccountLevel pval on pval.PreVoucherItemID = a.PreVoucherItemID and pval.AccountLevelID = b.AccountLevelID
		 where pval.PreVoucherItemAccountLevelID is null

		  SELECT remittanceitemid,InvoiceItemID,outgoingitemid,CostCenterID
		into #CostCenter
		from (
			select ri.remittanceitemid,null InvoiceItemID,null outgoingitemid,sa.CostCenterID
			from sle.remittanceitem ri
			join sle.remittance r on r.remittanceid = ri.remittanceid
			join sle.salearea sa on sa.saleareaid = r.saleareaid
			join stc.OutgoingItem oi on oi.RemittanceItemID = ri.RemittanceItemID
			join #TempOfOutgoingItems a on a.OutgoingItemID = oi.OutgoingItemID

			union all

			select null remittanceitemid,ri.InvoiceItemID,ri.outgoingitemid,sa.CostCenterID
			from sle.invoiceitem ri 
			join sle.invoice r on r.invoiceid = ri.invoiceid
			join sle.salearea sa on sa.saleareaid = r.saleareaid
			join stc.OutgoingItem oi on oi.InvoiceItemID = ri.InvoiceItemID or oi.OutgoingItemID = ri.OutgoingItemId
			join #TempOfOutgoingItems a on a.OutgoingItemID = oi.OutgoingItemID

			)A

		  INSERT INTO Acc.PreVoucherItemAccountLevel
				(
				PreVoucherItemID,
				AccountLevelID,
				DLID,
				[Value],
				Creator,
				CreationDate,
				LastEditor,
				LastEditionDate,
				Version
				)
		SELECT		pvi.PreVoucherItemID,
					s.AccountLevelID,
					cc.dlid,
					null,
					@CreatorId,
					GETDATE(),
					@CreatorId,
					GETDATE(),
					0
		from #TempOfOutgoingItems i
		join acc.PreVoucherItem pvi on pvi.BaseDocumentName = 'OutgoingItem' and pvi.BaseDocumentID = i.OutgoingItemID
		join stc.outgoingitem oi on oi.outgoingitemid = i.outgoingitemid
		join #CostCenter cc0 on cc0.RemittanceItemID = oi.RemittanceItemID or cc0.InvoiceItemID = oi.InvoiceItemID or cc0.outgoingitemid = oi.OutgoingItemID
		join cfg.CostCenter cc on cc.CostCenterID = cc0.CostCenterID
		join acc.AccountLevelSL s on pvi.SlID = s.SlID
		join acc.dl on dl.DLID = cc.DlID and s.DlTypeID = dl.DlTypeID
		left join acc.PreVoucherItemAccountLevel a on pvi.PreVoucherItemID = a.PreVoucherItemID
												   and s.AccountLevelID = a.AccountLevelID
		where a.PreVoucherItemAccountLevelID is null

		  INSERT INTO Acc.PreVoucherItemAccountLevel
				(
				PreVoucherItemID,
				AccountLevelID,
				DLID,
				[Value],
				Creator,
				CreationDate,
				LastEditor,
				LastEditionDate,
				Version
				)
		SELECT		pvi.PreVoucherItemID,
					als.AccountLevelID,
					dl.dlid,
					null,
					@CreatorId,
					GETDATE(),
					@CreatorId,
					GETDATE(),
					0
		from #TempOfOutgoingItems i
		join #Outgoing h on h.OutgoingID = i.OutgoingID
		join acc.PreVoucherItem pvi on pvi.BaseDocumentName = 'OutgoingItem' and pvi.BaseDocumentID = i.OutgoingItemID
		join pos.Station s on s.DlID = h.DeliverDlID
		join acc.AccountLevelSL als on pvi.SlID = als.SlID
		join acc.dl on dl.DLID = s.CostCenterDlID and als.DlTypeID = dl.DlTypeID
		left join acc.PreVoucherItemAccountLevel a on pvi.PreVoucherItemID = a.PreVoucherItemID
												   and als.AccountLevelID = a.AccountLevelID
		where a.PreVoucherItemAccountLevelID is null

			DECLARE db_cursor CURSOR FOR
			select TRACEID,DlTypeID
			FROM STF.Trace WHERE DlTypeID IS NOT NULL
	 	
			OPEN db_cursor   
			FETCH NEXT FROM db_cursor INTO @TRACEID,@DlType

			WHILE @@FETCH_STATUS = 0   
			BEGIN  

			 set @Query = N'	      
			 INSERT INTO Acc.PreVoucherItemAccountLevel
				  (
					PreVoucherItemID,
					AccountLevelID,
					DLID,
					[Value],
					Creator,
					CreationDate,
					LastEditor,
					LastEditionDate,
					Version
				  )
				SELECT pvi.PreVoucherItemID,
					   als.AccountLevelID,
					   a.'+QUOTENAME(@TRACEID)+',
					   NULL,
					   @pCreatorId,
					   GETDATE(),
					   @pCreatorId,
					   GETDATE(),
					   0
				FROM    #TempOfOutgoingItems a
				join acc.PreVoucherItem pvi on pvi.BaseDocumentName = ''OutgoingItem'' and pvi.BaseDocumentID = a.OutgoingItemID
				INNER JOIN Acc.AccountLevelSL als ON  als.SlID =   a.SlID 
				left join acc.PreVoucherItemAccountLevel pval on pval.PreVoucherItemID = pvi.PreVoucherItemID and pval.AccountLevelID = als.AccountLevelID
				where pval.PreVoucherItemAccountLevelID is null
				and  als.DlTypeID = @pDlTypeId  and a.'+QUOTENAME(@TRACEID)+' is not null '
	        
		   SET @QueryParam =N'@pCreatorId INT,@pDlTypeId INT'
		
			EXECUTE sp_executeSQL     
				@Query,
				@QueryParam,
				@pCreatorId = @creatorId,
				@pDlTypeId = @DlType
			
			FETCH NEXT FROM db_cursor INTO @TRACEID,@DlType
			END   

			CLOSE db_cursor   
			DEALLOCATE db_cursor

		
	    -- Update Item Descriptions
UPDATE pi
SET 
    [Description] = v.Description,
    [Description2] = v.Description2,
    RowIndex = v.RowIndex
FROM acc.PreVoucherItem pi
JOIN #Outgoing i ON pi.PreVoucherID = i.PreVoucherID
JOIN #TempOfOutgoingItems toi ON i.OutgoingID = toi.OutgoingID
CROSS APPLY (
    SELECT
        ROW_NUMBER() OVER(PARTITION BY pi.PreVoucherID ORDER BY pi.PreVoucherItemID) AS RowIndex,
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            pi.Description,
            '@@Number@@', i.Number),
            '@@Date_Gregorian@@', i.FullDateAlternateKey),
            '@@Date_Solar@@', i.PersianFullDateAlternateKey),
            '@@OutgoingType@@', i.OutgoingType),
            '@@StockName@@', i.StockName),
            '@@Recipient@@', isnull(i.Recipient,'')),
            '@@ItemDescription@@', ISNULL(toi.ItemDescription, '')
        ) AS Description,
        REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            pi.Description2,
            '@@Number@@', i.Number),
            '@@Date_Gregorian@@', i.FullDateAlternateKey),
            '@@Date_Solar@@', i.PersianFullDateAlternateKey),
            '@@OutgoingType@@', i.OutgoingType2),
            '@@StockName@@', i.StockName2),
            '@@Recipient@@', isnull(i.Recipient2,'')),
            '@@ItemDescription@@', ISNULL(toi.ItemDescription2, '')
        ) AS Description2
) v
OPTION (RECOMPILE)


		update pi
		set [Description] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@OutgoingType@@',OutgoingType),
						'@@StockName@@',StockName),
						'@@Recipient@@',isnull(Recipient,'')),
						'@@ItemDescription@@',ISNULL(toi.ItemDescription,'')),
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description2,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@OutgoingType@@',OutgoingType2),
						'@@StockName@@',StockName2),
						'@@Recipient@@',isnull(Recipient2,'')),
						'@@ItemDescription@@',ISNULL(toi.ItemDescription2,''))
		from acc.PreVoucher pi
		join #Outgoing i on pi.PrevoucherID = i.PrevoucherID
		JOIN #TempOfOutgoingItems toi ON i.OutgoingID = toi.OutgoingID
