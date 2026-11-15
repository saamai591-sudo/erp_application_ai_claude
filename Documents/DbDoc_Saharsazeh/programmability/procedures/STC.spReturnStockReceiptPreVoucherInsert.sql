
-------------------------------------

create   PROCEDURE [STC].spReturnStockReceiptPreVoucherInsert

	@ReturnStockReceiptId NVARCHAR(MAX)
	--WITH ENCRYPTION 
AS


		DECLARE @DocumentNumTypeId INT = (		
									SELECT  DNT.DocumentNumTypeID
									FROM   CFG.DocumentNumType DNT
									WHERE  DNT.EngName = 'ReturnStockReceipt'),
				@MDEntity INT = (select Top 1 Id from mdt.DmdEntity where Name = 'ReturnStockReceipt'),
				@DlType int,
				@TRACEID INT,
				@Precision tinyint,
				@MaxPrevoucherID int,
				@creatorId INT ,
				@Culture VARCHAR(10),
				@CultureNo TinyInt,
				@HeaderDescription  nvarchar(max),
				@HeaderDescription2 nvarchar(max),
				@InventoryDescription  nvarchar(max),
				@InventoryDescription2  nvarchar(max),
				@PurchaseControlDescription nvarchar(max),
				@PurchaseControlDescription2 nvarchar(max),
				@OtherCostDescription nvarchar(max),
				@OtherCostDescription2 nvarchar(max)

		set @Precision = [CFG].[GetBaseCurrencyPrecision]();
		set @creatorId = cfg.GetuserID();
		SET @Culture = CFG.GetuserCulture()

		select @CultureNo = CultureNo
		from cfg.CultureInfo
		where Culture = @Culture

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@ReturnStockReceiptId) 

		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'


		select  @InventoryDescription = Description,
				@InventoryDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Inventory'

		select  @PurchaseControlDescription = Description,
				@PurchaseControlDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'PurchaseControl'

		select  @OtherCostDescription = Description,
				@OtherCostDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'OtherCost'
				
		 --- FetchValues ---
		select @MaxPrevoucherID = max(PreVoucherID)
		from acc.PreVoucher

	    SELECT  sr.ReturnStockReceiptID,
				isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by sr.ReturnStockReceiptID) PrevoucherID,
				sr.DeliverDlID,
				St.BranchID,
				sr.Number ,
				sr.FinancialPeriodID,
				sr.date,
				@HeaderDescription [Description],
				@HeaderDescription2 [Description2],
				cast(null as varchar(max)) ErrorMessage,
				DD.FullDateAlternateKey,
				DD.PersianFullDateAlternateKey,
				sdt.StockDocumentTypeID,
				case when @CultureNo = 1 then sdt.Title else sdt.Title2 end StockDocumentType,
				st.StockTypeID,
				st.Title AS StockName,
				st.Title2 AS StockName2,
				sdt.Title AS ReceiptType,
				sdt.Title2 AS ReceiptType2,
				dl.Title AS DeliverStock,
				dl.Title2 AS DeliverStock2
			into #ReturnStockReceipt
	    FROM STC.ReturnStockReceipt sr
		JOIN #DocumentIds on #DocumentIds.ID = sr.ReturnStockReceiptID
	    JOIN stf.Stock AS St
	        ON  sr.StockID = St.StockID	     
		JOIN cfg.DimDate DD on DD.Date = sr.Date
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		join stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
		LEFT JOIN ACC.DL dl ON dl.DLID = sr.DeliverDlID
	    
		create TABLE #TempOfReturnStockReceiptItems
		(	
			ReturnStockReceiptID int,
			ReturnStockReceiptItemID int,
			PreVoucherId int,
	    	Price         DECIMAL(18, 4),
	    	ShareOfCost          DECIMAL(18, 4),
	    	InventorySlID        INT,
			InventoryDescription  nvarchar(max),
			InventoryDescription2  nvarchar(max),
			PurchaseControlDescription nvarchar(max),
			PurchaseControlDescription2 nvarchar(max),	
			OtherCostDESCRIPTION        NVARCHAR(MAX),
			OtherCostDESCRIPTION2        NVARCHAR(MAX),
			StuffAccountGroup NVARCHAR(MAX),
	    	SlID				 INT)	
			
		IF EXISTS (SELECT TRACEID FROM STF.Trace WHERE DlTypeID IS NOT NULL)
		BEGIN
		 
		DECLARE @Columns NVARCHAR(MAX),
				@ColumnsInALTERTable NVARCHAR(MAX),
				@ColumnsInSelectList NVARCHAR(MAX),
				@Query NVARCHAR(MAX),
				@QueryParam NVARCHAR(MAX);

		select @ColumnsInALTERTable = STUFF((SELECT distinct ' alter table #TempOfReturnStockReceiptItems add ' + QUOTENAME(TraceID) +'INT'
								FROM STF.Trace WHERE DlTypeID IS NOT NULL
								FOR XML PATH(''), TYPE
								).value('.', 'NVARCHAR(MAX)'),1,1,'')
								
		if @ColumnsInALTERTable is not null
			exec(@ColumnsInALTERTable);								
							   
		select @Columns = STUFF((SELECT distinct ',' + QUOTENAME(TraceID)
								FROM STF.Trace WHERE DlTypeID IS NOT NULL
								FOR XML PATH(''), TYPE
								).value('.', 'NVARCHAR(MAX)'),1,1,'')
			   
			set @Query = N'INSERT INTO #TempOfReturnStockReceiptItems
			(	
			ReturnStockReceiptID,
			ReturnStockReceiptItemID,
			PreVoucherId,
			Price,
			ShareOfCost,
			InventorySlID,
			InventoryDescription,
			InventoryDescription2,
			PurchaseControlDescription,
			PurchaseControlDescription2,
			OtherCostDESCRIPTION,
			OtherCostDESCRIPTION2,
			StuffAccountGroup,
			SlID,'+@Columns+'
			)
		SELECT st.ReturnStockReceiptID,
				ARI.ReturnStockReceiptItemID,
				st.PreVoucherId,
				ARI.Price,
				isnull(ROUND(((srari.ShareOfCosts /srari.MainQuantity) * ARI.MainQuantity ) , @Precision),0),
				sagas.InventorySlID,
				Replace(@InventoryDescription,''@@ItemDescription@@'',isnull(ARI.DESCRIPTION,'''')),
				Replace(@InventoryDescription2,''@@ItemDescription@@'',isnull(ARI.DESCRIPTION,'''')),
				Replace(@PurchaseControlDescription,''@@ItemDescription@@'',isnull(ARI.DESCRIPTION,'''')),
				Replace(@PurchaseControlDescription2,''@@ItemDescription@@'',isnull(ARI.DESCRIPTION,'''')),
				Replace(@OtherCostDESCRIPTION,''@@ItemDescription@@'',isnull(ARI.DESCRIPTION,'''')),
				Replace(@OtherCostDESCRIPTION2,''@@ItemDescription@@'',isnull(ARI.DESCRIPTION,'''')),
				case when @CultureNo = 1 then stfacc.Title else stfacc.Title2 end,
				wip.slid,'+@Columns+'		           
		FROM   #ReturnStockReceipt St
				LEFT JOIN stc.ReturnStockReceiptItem ARI   ON  St.ReturnStockReceiptID = ARI.ReturnStockReceiptID
				LEFT JOIN(select ReturnStockReceiptItemID,TraceID,DLID
	           					from stc.ReturnStockReceiptItemTrace 
							WHERE DLID IS NOT NULL ) x
										pivot 
										(
											max(DLID)
											for TraceID in ( ' + @Columns + ')
										) p  on ARI.ReturnStockReceiptItemID = p.ReturnStockReceiptItemID
				LEFT JOIN STC.StockReceiptItem srari on 	srari.StockReceiptItemID = ARI.StockReceiptItemID
				LEFT JOIN stf.StuffDetail stfdtl ON  ARI.StuffID = stfdtl.StuffID
				LEFT JOIN stf.StuffAccountGroup stfacc ON  stfacc.StuffAccountGroupID = stfdtl.StuffAccountGroupID
			    LEFT JOIN stf.StuffAccountGroupAccountSl sagas ON st.StockTypeID = sagas.StockTypeID 
															  and sagas.StuffAccountGroupID = stfacc.StuffAccountGroupID
				LEFT JOIN stf.StockDocumentTypeSlDl wip on wip.StuffAccountGroupID = stfacc.StuffAccountGroupID 
													and wip.StockDocumentTypeID = st.StockDocumentTypeID
													and (wip.dlid is null or wip.DlID = st.DeliverDlID)
		ORDER BY  ARI.RowIndex'

	SET @QueryParam =N' @InventoryDescription  nvarchar(max),
						@InventoryDescription2  nvarchar(max),
						@PurchaseControlDescription nvarchar(max),
						@PurchaseControlDescription2 nvarchar(max),
						@OtherCostDESCRIPTION        NVARCHAR(MAX),
						@OtherCostDESCRIPTION2        NVARCHAR(MAX),
						@Precision TinyInt,
						@CultureNo TinyInt'
	EXECUTE sp_executeSQL     
		@Query,
		@QueryParam,
		@InventoryDescription = @InventoryDescription,
		@InventoryDescription2 = @InventoryDescription2,
		@PurchaseControlDescription = @PurchaseControlDescription,
		@PurchaseControlDescription2 = @PurchaseControlDescription2,
		@OtherCostDESCRIPTION = @OtherCostDESCRIPTION,
		@OtherCostDESCRIPTION2 = @OtherCostDESCRIPTION2,
		@Precision = @Precision,
		@CultureNo = @CultureNo

		END
		ELSE
		BEGIN

		INSERT INTO #TempOfReturnStockReceiptItems
			(
			ReturnStockReceiptID,
			ReturnStockReceiptItemID,
			PreVoucherId,
			Price,
			ShareOfCost,
			InventorySlID,
			InventoryDescription,
			InventoryDescription2,
			PurchaseControlDescription,
			PurchaseControlDescription2,
			OtherCostDESCRIPTION,
			OtherCostDESCRIPTION2,
			StuffAccountGroup,
			SlID
			)
		SELECT st.ReturnStockReceiptID,
				ARI.ReturnStockReceiptItemID,
				st.PreVoucherId,
				ARI.Price,
				isnull(ROUND(((srari.ShareOfCosts /srari.MainQuantity) * ARI.MainQuantity ) , @Precision ),0),
				sagas.InventorySlID,
				Replace(@InventoryDescription,'@@ItemDescription@@',isnull(ARI.DESCRIPTION,'')),
				Replace(@InventoryDescription2,'@@ItemDescription@@',isnull(ARI.DESCRIPTION2,'')),
				Replace(@PurchaseControlDescription,'@@ItemDescription@@',isnull(ARI.DESCRIPTION,'')),
				Replace(@PurchaseControlDescription2,'@@ItemDescription@@',isnull(ARI.DESCRIPTION2,'')),
				Replace(@OtherCostDESCRIPTION,'@@ItemDescription@@',isnull(ARI.DESCRIPTION,'')),
				Replace(@OtherCostDESCRIPTION2,'@@ItemDescription@@',isnull(ARI.DESCRIPTION2,'')),
				case when @CultureNo = 1 then stfacc.Title else stfacc.Title2 end,
				wip.SlID		    	           
		FROM   #ReturnStockReceipt St
				LEFT JOIN stc.ReturnStockReceiptItem ARI   ON  St.ReturnStockReceiptID = ARI.ReturnStockReceiptID	
				LEFT JOIN STC.StockReceiptItem srari on 	srari.StockReceiptItemID = ARI.StockReceiptItemID          
				LEFT JOIN stf.StuffDetail stfdtl ON  ARI.StuffID = stfdtl.StuffID
				LEFT JOIN stf.StuffAccountGroup stfacc ON  stfacc.StuffAccountGroupID = stfdtl.StuffAccountGroupID
			    LEFT JOIN stf.StuffAccountGroupAccountSl sagas ON st.StockTypeID = sagas.StockTypeID 
															  and sagas.StuffAccountGroupID = stfacc.StuffAccountGroupID
				LEFT JOIN stf.StockDocumentTypeSlDl wip on wip.StuffAccountGroupID = stfacc.StuffAccountGroupID 
													and wip.StockDocumentTypeID = st.StockDocumentTypeID
													and (wip.dlid is null or wip.DlID = st.DeliverDlID)
		ORDER BY  ARI.RowIndex
		END


		update h
		set ErrorMessage = N'STC_spReturnStockReceiptPreVoucherInsert_2^'+cast(Number as varchar(10))+char(10)+char(13)
		from #ReturnStockReceipt h
		join #TempOfReturnStockReceiptItems i on h.ReturnStockReceiptID = i.ReturnStockReceiptID
		where Price = 0
			
		update h
		set ErrorMessage =  isnull(ErrorMessage,'') + N'InventorySlNotSpecified'+char(10)+char(13)
		from #ReturnStockReceipt h
		join #TempOfReturnStockReceiptItems i on h.ReturnStockReceiptID = i.ReturnStockReceiptID
		where InventorySlID IS NULL

		update h
		set ErrorMessage = isnull(ErrorMessage,'') + N'SlNotSpecifiedInStuffAccountGroupForTheStockReceiptType^'+StuffAccountGroup+','+h.StockDocumentType+char(10)+char(13)
		from #ReturnStockReceipt h
		join #TempOfReturnStockReceiptItems i on h.ReturnStockReceiptID = i.ReturnStockReceiptID
		where SlID IS NULL

		DECLARE @OtherCostSl INT;
		SELECT TOP 1 @OtherCostSl = sc.ConfigValue
		FROM   CFG.Configuration sc
		WHERE  sc.ConfigKey = 'OtheExpensesId';
	    
		IF @OtherCostSl IS NULL
		BEGIN					
			update h
			set ErrorMessage =  isnull(ErrorMessage,'') + N'OtherExpenseSLNotSpecified'+char(10)+char(13)
			from #ReturnStockReceipt h
			join #TempOfReturnStockReceiptItems i on h.ReturnStockReceiptID = i.ReturnStockReceiptID
			where ShareOfCost > 0
		END	

		if exists (select * from #ReturnStockReceipt where ErrorMessage is not null )
		BEGIN	
			select ReturnStockReceiptID,ErrorMessage from #ReturnStockReceipt
			RETURN;
		END

		set identity_insert [ACC].[PreVoucher] on
	    INSERT INTO [ACC].[PreVoucher](PrevoucherID,[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT PrevoucherID,BranchId,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #ReturnStockReceipt
		set identity_insert [ACC].[PreVoucher] off
    

	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from stc.ReturnStockReceipt a
		join #ReturnStockReceipt b on a.ReturnStockReceiptID = b.ReturnStockReceiptID

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
	            it.SlID,
	            PurchaseControlDescription,
	            PurchaseControlDescription2,
	            Price - ShareOfCost,
	            0,
	            -1,
	            1,
	            Price - ShareOfCost,
	            0,
	            1,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
				0,
				'ReturnStockReceiptItem',
				ReturnStockReceiptItemID
	    FROM   #TempOfReturnStockReceiptItems It
	        
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
	            @OtherCostSl,
	            OtherCostDESCRIPTION,
	            OtherCostDESCRIPTION2,
	            It.ShareOfCost ,
	            0,
	            -1,
	            1,
	            It.ShareOfCost,
	            0,
	            1,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
				0,
				'ReturnStockReceiptItem',
				ReturnStockReceiptItemID
	    FROM   #TempOfReturnStockReceiptItems It
	    WHERE  it.ShareOfCost > 0;	        
	      
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
				'ReturnStockReceiptItem',
				ReturnStockReceiptItemID
	    FROM   #TempOfReturnStockReceiptItems It
	    WHERE  it.Price > 0;
		
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
	            b.AccountLevelID,
	            DeliverDlID,
	            NULL,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0
		from #ReturnStockReceipt h
		join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
		join acc.accountlevelsl b on a.slid = b.slid 
		join acc.dl c on c.DLID = h.DeliverDlID and c.DlTypeID = b.DlTypeID
	  
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
	            b.AccountLevelID,
	            c.DlID,
	            NULL,
	            @CreatorId,
	            GETDATE(),
	            @CreatorId,
	            GETDATE(),
	            0
		from #ReturnStockReceipt h
		join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
		join acc.accountlevelsl b on a.slid = b.slid 
		join stc.ReturnStockReceiptDl c on c.ReturnStockReceiptID = h.ReturnStockReceiptID and c.DlTypeID = b.DlTypeID

	      DECLARE db_cursor CURSOR FOR
			select TRACEID,DlTypeID
			FROM STF.Trace WHERE DlTypeID IS NOT NULL
	 	
		OPEN db_cursor   
		FETCH NEXT FROM db_cursor INTO @TRACEID,@DlType

		WHILE @@FETCH_STATUS = 0   
		BEGIN  
		 set @Query = N'INSERT INTO Acc.PreVoucherItemAccountLevel
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
	        SELECT a.ReturnStockReceiptItemID,
	               als.AccountLevelID,
	               a.'+QUOTENAME(@TRACEID)+',
	               NULL,
	               @pCreatorId,
	               GETDATE(),
	               @pCreatorId,
	               GETDATE(),
	               0
	        FROM    #TempOfReturnStockReceiptItems a
			join acc.PreVoucherItem pvi on pvi.BaseDocumentName = ''ReturnStockReceiptItem'' and pvi.BaseDocumentID = a.ReturnStockReceiptItemID
	        INNER JOIN Acc.AccountLevelSL als
	            ON  als.SlID =  a.SlID
	        WHERE  als.DlTypeID = @pDlTypeId and a.'+QUOTENAME(@TRACEID)+' is not null'
	        
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


		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by PreVoucherItemID) RowIndex,
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
						'@@StockName@@',i.StockName),
						'@@ReceiptType@@',i.ReceiptType),
						'@@Delivery@@',i.DeliverStock) 
						[Description],
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
						'@@StockName@@',i.StockName2),
						'@@ReceiptType@@',i.ReceiptType2),
						'@@Delivery@@',i.DeliverStock2)
						[Description2]
			from #ReturnStockReceipt i
			join  acc.PreVoucherItem [pi]  on [pi].PrevoucherID = i.PreVoucherID
		)

		update v
		set RowIndex = vi.RowIndex,
			Description = vi.Description,
			Description2 = vi.Description2
		from acc.PreVoucherItem v
		join temp vi  on v.PreVoucherItemID = vi.PreVoucherItemID

		update pi
		set [Description] =
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
						'@@StockName@@',i.StockName),
						'@@ReceiptType@@',i.ReceiptType),
						'@@Delivery@@',i.DeliverStock),
			[Description2] =
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
						'@@StockName@@',i.StockName2),
						'@@ReceiptType@@',i.ReceiptType2),
						'@@Delivery@@',i.DeliverStock2)

		from acc.PreVoucher pi
		join #ReturnStockReceipt i on pi.PrevoucherID = i.PrevoucherID
