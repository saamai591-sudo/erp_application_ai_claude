
--------------------------------------------------------
CREATE   PROCEDURE [STC].spStockReceiptPreVoucherInsert
	@StockReceiptId NVARCHAR(MAX)
	--WITH ENCRYPTION 
AS


		DECLARE 	    
				@DocumentNumTypeId INT = (		
									SELECT  DNT.DocumentNumTypeID
									FROM   CFG.DocumentNumType DNT
									WHERE  DNT.EngName = 'StockReceipt'),
				@MDEntity INT = (select TOP(1) de.ID from mdt.DmdEntity AS de where [Name] = 'StockReceipt'),
				@DlTypeId        INT,
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
				@ReceiptCostDescription nvarchar(max),
				@ReceiptCostDescription2 nvarchar(max)

		set @creatorId = cfg.GetuserID();
		SET @Culture = CFG.GetuserCulture()

		select @CultureNo = CultureNo
		from cfg.CultureInfo
		where Culture = @Culture

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@StockReceiptId) 

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

		select  @ReceiptCostDescription = Description,
				@ReceiptCostDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'ReceiptCost'
				

		SELECT sri.StockReceiptID,SUM(sri.Price) Price INTO #StockReceiptPrice
		FROM  #DocumentIds di 
		JOIN stc.stockReceiptItem sri ON di.ID = sri.StockReceiptID
		GROUP BY sri.StockReceiptID

		SELECT @MaxPrevoucherID = MAX(PreVoucherID)
		FROM acc.PreVoucher
		 --- FetchValues ---
		SELECT  ISNULL(@MaxPrevoucherID,0) + ROW_NUMBER() OVER(ORDER BY sr.StockReceiptID) PrevoucherID,
				sr.StockReceiptID,
				sdt.DocumentType,
				sr.DeliverDlID,
				St.BranchID,
				cast(sr.Number as varchar(100)) Number,
				sr.FinancialPeriodID,
				sr.Date,
				sdt.SlBaseOnDl,
				sdt.Title StockDocumentType,
				sdt.Title2 StockDocumentType2,
				sdtb.BaseEntity,
				@HeaderDescription   [Description],
				@HeaderDescription2  [Description2],
				DD.FullDateAlternateKey,
				DD.PersianFullDateAlternateKey,
				sdtb.StockDocumentTypeID,
				cast(null as varchar(max)) ErrorMessage,
				st.StockTypeID,
				dst.StockTypeID DestinationStockTypeID,
				sri.Price TotalRealPrice	,
				isnull(DD1.FullDateAlternateKey,'') AccountingFullDateAlternateKey,
				isnull(DD1.PersianFullDateAlternateKey,'') AccountingPersianFullDateAlternateKey,
				case when sr.DeliverStockID is not null then dst.Title 
					 when sr.DeliverDlID is not null then dl.Title
					 end DelivererName,
				case when sr.DeliverStockID is not null then dst.Title2
					 when sr.DeliverDlID is not null then dl.Title2
					 end DelivererName2,
				st.Title StockTitle,
				st.Title2 StockTitle2
			into #StockReceipt
		FROM   STC.StockReceipt sr
		join #StockReceiptPrice sri on sr.StockReceiptID = sri.StockReceiptID
		JOIN #DocumentIds on #DocumentIds.ID = sr.StockReceiptID
		JOIN stf.Stock AS St ON  sr.StockID = St.StockID
		JOIN [STC].[StockDocumentTypeBaseEntity] sdtb
			ON sr.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
		JOIN stc.StockDocumentType sdt on sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
		JOIN cfg.DimDate DD on DD.Date = sr.Date
		Left JOIN cfg.DimDate DD1 on DD1.Date = sr.[Date]
		Left JOIN stf.Stock AS dSt ON  sr.DeliverStockID = dSt.StockID
		left join acc.dl on dl.DLID = sr.DeliverDlID
		where sr.PreVoucherID is null
		


		update #StockReceipt 
		set ErrorMessage = isnull(ErrorMessage,'') + 'STC_spStockReceiptPreVoucherInsert_2'+char(10)+char(13)
		where DocumentType = 7

		DECLARE @HasAccountingVoucher BIT
		SELECT @HasAccountingVoucher = CASE WHEN lower(ConfigValue) = 'true' THEN 1 ELSE 0 END
		 FROM CFG.Configuration sc
		WHERE sc.ConfigKey = 'TranslationBetweenStocksHasAccountingVoucher'


		if @HasAccountingVoucher = 0 
		begin
		update #StockReceipt 
		set ErrorMessage = isnull(ErrorMessage,'') + N'STC_spStockReceiptPreVoucherInsert_5^'+cast(Number as varchar(10))+char(10)+char(13)
		where DocumentType = 5
		and StockTypeID = DestinationStockTypeID
		END
		
		if exists (select * from #StockReceipt where ErrorMessage is not null )
		BEGIN	
			select StockReceiptID,ErrorMessage from #StockReceipt
			RETURN;
		END
   
		create TABLE #TempOfStockReceiptItems
		(
			StockReceiptID int,
			PreVoucherID int,
			StockReceiptItemID int,
			ShareOfCosts         DECIMAL(30, 4),
			InvoicePrice         DECIMAL(30, 4),
			InvoiceFee           DECIMAL(30, 4),
			EstimatedPrice		 DECIMAL(30, 4),
			PurchaseInvoice		 INT,
			InventorySlID        INT,
			SlID				 INT,
			RowNum               INT,
			DeliverDlID          bigint,
			StuffAccountGroup	 nvarchar(500),
			StockDocumentType    nvarchar(500),
			InventoryDescription  nvarchar(max),
			InventoryDescription2  nvarchar(max),
			PurchaseControlDescription nvarchar(max),
			PurchaseControlDescription2 nvarchar(max)	,
			ContractDlID bigint
		)
			
		IF EXISTS (SELECT TRACEID FROM STF.Trace WHERE DlTypeID IS NOT NULL)
		BEGIN
	 
		DECLARE @Columns NVARCHAR(MAX),
				@ColumnsInALTERTable NVARCHAR(MAX),
				@ColumnsInSelectList NVARCHAR(MAX),
				@Query NVARCHAR(MAX),
				@QueryParam NVARCHAR(MAX);

		select @ColumnsInAlterTable = 
		STUFF((SELECT distinct ' alter table #TempOfStockReceiptItems add ' + QUOTENAME(TraceID) +'INT'
								FROM STF.Trace WHERE DlTypeID IS NOT NULL
								FOR XML PATH(''), TYPE
							   ).value('.', 'NVARCHAR(MAX)'),1,1,'')
							   
		if @ColumnsInALTERTable is not null
			exec(@ColumnsInALTERTable);
			
		select @Columns = STUFF((SELECT distinct ',' + QUOTENAME(TraceID)
								FROM STF.Trace WHERE DlTypeID IS NOT NULL
								FOR XML PATH(''), TYPE
							   ).value('.', 'NVARCHAR(MAX)'),1,1,'')

		 set @Query = N'INSERT INTO #TempOfStockReceiptItems
		  ( 
			StockReceiptID,
			PreVoucherID ,
			StockReceiptItemID,
			ShareOfCosts,
			InvoicePrice,
			InvoiceFee,
			EstimatedPrice,
			PurchaseInvoice,
			InventorySlID,
			SlID,
			RowNum,
			DeliverDlID,
			StuffAccountGroup,
			StockDocumentType,
			InventoryDescription,
			InventoryDescription2,
			PurchaseControlDescription,
			PurchaseControlDescription2,
			ContractDlID,  
			'+@Columns+'
		  )
		SELECT st.StockReceiptID,
			   PreVoucherID,
			   ARI.StockReceiptItemID,
			   ARI.ShareOfCosts,
			   ARI.Price,
			   ARI.Fee,
			   ARI.EstimatedPrice,
			   ARI.PurchaseInvoiceItemID,
			   sagas.InventorySlID,
			   wip.SlID ,
			   ROW_NUMBER() OVER(partition by St.StockReceiptID ORDER BY ARI.RowIndex),
			   st.DeliverDlID,
			   stfacc.Title,
			   SDT.Title,
			   REPLACE(@InventoryDescription,''@@ItemDescription@@'',isnull(ARI.Description,'''')),
			   REPLACE(@InventoryDescription2,''@@ItemDescription@@'',isnull(ARI.Description,'''')),
			   REPLACE(@PurchaseControlDescription,''@@ItemDescription@@'',isnull(ARI.Description,'''')),
			   REPLACE(@PurchaseControlDescription2,''@@ItemDescription@@'',isnull(ARI.Description,'''')),
			   cs.dlid,
			   '+@Columns+'	           
		FROM   #StockReceipt St
			   JOIN stC.StockDocumentType SDT ON SDT.StockDocumentTypeID = ST.StockDocumentTypeID
			   LEFT JOIN stc.StockReceiptItem ARI   ON  St.StockReceiptID = ARI.StockReceiptID
			   LEFT JOIN(select StockReceiptItemID,TraceID,DLID
							 from stc.StockReceiptItemTrace 
						 WHERE DLID IS NOT NULL ) x
										pivot 
										(
											 max(DLID)
											for TraceID in ( ' + @Columns + ')
										) p  on ARI.StockReceiptItemID = p.StockReceiptItemID
			   LEFT JOIN stf.StuffDetail stfdtl ON  ARI.StuffID = stfdtl.StuffID
			   LEFT JOIN stf.StuffAccountGroup stfacc ON  stfacc.StuffAccountGroupID = stfdtl.StuffAccountGroupID
			   LEFT JOIN stf.StuffAccountGroupAccountSl sagas ON st.StockTypeID = sagas.StockTypeID 
															  and sagas.StuffAccountGroupID = stfacc.StuffAccountGroupID
			   LEFT JOIN stf.StockDocumentTypeSlDl wip  on wip.StuffAccountGroupID = stfacc.StuffAccountGroupID 
														and wip.StockDocumentTypeID = st.StockDocumentTypeID
														and (wip.dlid is null or wip.DlID = st.DeliverDlID)
			   left join
			   (
			   select cs.contractsubjectid,c.dlid
			   from cnt.contractsubject cs
			   join cnt.contract c on c.ContractID = cs.contractid
			   ) cs on cs.contractsubjectid = ari.contractsubjectid
														'
		
		SET @QueryParam =N' @InventoryDescription  nvarchar(max),
							@InventoryDescription2  nvarchar(max),
							@PurchaseControlDescription nvarchar(max),
							@PurchaseControlDescription2 nvarchar(max)		'
		EXECUTE sp_executeSQL     
			@Query,
			@QueryParam,
			@InventoryDescription = @InventoryDescription,
			@InventoryDescription2 = @InventoryDescription2,
			@PurchaseControlDescription = @PurchaseControlDescription,
			@PurchaseControlDescription2 = @PurchaseControlDescription2
			   
		END
		ELSE
		BEGIN

		INSERT INTO #TempOfStockReceiptItems
		  (
			StockReceiptID,
			PreVoucherID,
			StockReceiptItemID,
			ShareOfCosts,
			InvoicePrice,
			InvoiceFee,
			EstimatedPrice,
			PurchaseInvoice,
			InventorySlID,
			SlID,
			RowNum,
			DeliverDlID,
			StuffAccountGroup,
			StockDocumentType,
			InventoryDescription,
			InventoryDescription2,
			PurchaseControlDescription,
			PurchaseControlDescription2,
			ContractDlID
		  )
		SELECT st.StockReceiptID,
				PreVoucherID,
				ari.StockReceiptItemID,
			   ARI.ShareOfCosts,
			   ARI.Price,
			   ARI.Fee,
			   ARI.EstimatedPrice,
			   ARI.PurchaseInvoiceItemID,
			   sagas.InventorySlID,
			   wip.SlID ,
			   ROW_NUMBER() OVER(partition by St.StockReceiptID ORDER BY ARI.RowIndex),
			   st.DeliverDlID,
			   stfacc.Title,
			   SDT.Title,
			   REPLACE(@InventoryDescription,'@@ItemDescription@@',isnull(ARI.Description,'')),
			   REPLACE(@InventoryDescription2,'@@ItemDescription@@',isnull(ARI.Description,'')),
			   REPLACE(@PurchaseControlDescription,'@@ItemDescription@@',isnull(ARI.Description,'')),
			   REPLACE(@PurchaseControlDescription2,'@@ItemDescription@@',isnull(ARI.Description,'')),
			   cs.dlid
		FROM   #StockReceipt St
			   JOIN stC.StockDocumentType SDT ON SDT.StockDocumentTypeID = ST.StockDocumentTypeID
			   LEFT JOIN stc.StockReceiptItem ARI   ON  St.StockReceiptID = ARI.StockReceiptID
			   LEFT JOIN stf.StuffDetail stfdtl ON  ARI.StuffID = stfdtl.StuffID
			   LEFT JOIN stf.StuffAccountGroup stfacc ON  stfacc.StuffAccountGroupID = stfdtl.StuffAccountGroupID
			   LEFT JOIN stf.StuffAccountGroupAccountSl sagas ON st.StockTypeID = sagas.StockTypeID 
															  and sagas.StuffAccountGroupID = stfacc.StuffAccountGroupID
			   LEFT JOIN stf.StockDocumentTypeSlDl wip on wip.StuffAccountGroupID = stfacc.StuffAccountGroupID 
														and wip.StockDocumentTypeID = st.StockDocumentTypeID
														and (wip.dlid is null or wip.DlID = st.DeliverDlID)
			   left join
			   (
			   select cs.contractsubjectid,c.dlid
			   from cnt.contractsubject cs
			   join cnt.contract c on c.ContractID = cs.contractid
			   ) cs on cs.contractsubjectid = ari.contractsubjectid

		END

		update a
		set ErrorMessage = N'گروه حساب برای برخی از کالاهای این رسید تعیین نشده است'+char(10)+char(13)
		from #StockReceipt a
		join #TempOfStockReceiptItems b on a.StockReceiptID = b.StockReceiptID
		WHERE StuffAccountGroup is null

		if exists (select * from #StockReceipt where ErrorMessage is not null )
		BEGIN	
			select StockReceiptID,ErrorMessage from #StockReceipt
			RETURN;
		END
		update a
		set ErrorMessage = N'STC_spStockReceiptPreVoucherInsert_6^'+cast(Number as varchar(10))+char(10)+char(13)
		from #StockReceipt a
		join #TempOfStockReceiptItems b on a.StockReceiptID = b.StockReceiptID
		WHERE InvoicePrice = 0 and EstimatedPrice = 0

		update a
		set ErrorMessage = isnull(ErrorMessage,'') + N'InventorySlNotSpecified'+char(10)+char(13)
		from #StockReceipt a
		join #TempOfStockReceiptItems b on a.StockReceiptID = b.StockReceiptID
		WHERE InventorySlID IS NULL

		update a
		set ErrorMessage =  isnull(ErrorMessage,'') + 
							N'SlNotSpecifiedInStuffAccountGroupForTheStockReceiptType^'+StuffAccountGroup+','+
							case when @CultureNo = 1 then a.StockDocumentType else a.StockDocumentType2 end +char(10)+char(13)
		from #StockReceipt a
		join #TempOfStockReceiptItems b on a.StockReceiptID = b.StockReceiptID
		WHERE SlID IS NULL

		declare @OrderPricingSlID int
		select @OrderPricingSlID = ConfigValue
		 from cfg.Configuration
		where ConfigKey = 'OrderPricingSlID'

		update a
		set ErrorMessage = isnull(ErrorMessage,'') + N'InterfaceSlOfOrderPricingNotSpecified'+char(10)+char(13)
		from #StockReceipt a
		join #TempOfStockReceiptItems b on a.StockReceiptID = b.StockReceiptID
		WHERE BaseEntity = 10 and @OrderPricingSlID is null

		if exists (select * from #StockReceipt where ErrorMessage is not null )
		BEGIN	
			select StockReceiptID,ErrorMessage from #StockReceipt
			RETURN;
		END

		create TABLE #RCtemps
		(
			PreVoucherID int,
			StockReceiptID int,
			ReceiptCostID int,
			StuffID INT,
			Price                 DECIMAL(18, 4),
			CreditInPurchaseSlID  INT,
			RowNum                INT,
			ProformaDlID		  int,
			PurchaseInvoiceDlID   int,
			DESCRIPTION    nvarchar(max),
			DESCRIPTION2   nvarchar(max)
		)
			
		INSERT INTO #RCtemps
			(
			PreVoucherID,
			StockReceiptID,
			ReceiptCostID,
			StuffID,
			Price,
			CreditInPurchaseSlID,
			RowNum,
			ProformaDlID,
			PurchaseInvoiceDlID,
			DESCRIPTION,
			DESCRIPTION2
			)
		SELECT  st.PreVoucherID,
				st.StockReceiptID,
				rc.ReceiptCostID,
				RC.StuffID,
				rc.Price,
				rc.SlID,
				ROW_NUMBER() OVER(Partition by st.StockReceiptID ORDER BY rc.ReceiptCostID) + MaxRowNum,
				rc.ProformaDlId,
				case when pi.DlID is not null then pi.DlID else DeliverDlID end ,
				@ReceiptCostDescription,
				@ReceiptCostDescription2
		FROM    stc.ReceiptCost Rc
		INNER JOIN #StockReceipt St
					ON  St.StockReceiptID = Rc.StockReceiptID
		left join vnd.PurchaseInvoiceItem pii on pii.PurchaseInvoiceItemID = rc.PurchaseInvoiceItemID
		left join vnd.purchaseinvoice pi on pi.purchaseinvoiceid = pii.purchaseinvoiceid
		join
		(
		select StockReceiptID,max(RowNum) MaxRowNum
		from #TempOfStockReceiptItems
		group by StockReceiptID
		)x on x.StockReceiptID = st.StockReceiptID
		ORDER BY
				rc.ReceiptCostID;
			
		update a
		set ErrorMessage = N'CostSlInServiceNotSpecified^'+s.Title
		from #StockReceipt a
		join #RCtemps b on a.StockReceiptID = b.StockReceiptID
		join stf.stuff s on s.StuffID = b.StuffID
		WHERE CreditInPurchaseSlID is null

		if exists (select * from #StockReceipt where ErrorMessage is not null )
		BEGIN	
			select StockReceiptID,ErrorMessage from #StockReceipt
			RETURN;
		END


		set identity_insert [ACC].[PreVoucher] on
		INSERT INTO [ACC].[PreVoucher]([PreVoucherID],[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchId,@DocumentNumTypeId,[Date],FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #StockReceipt
		set identity_insert [ACC].[PreVoucher] off
	
	
		UPDATE a
		SET    PreVoucherID = b.PreVoucherId
		from stc.StockReceipt a
		join #StockReceipt b on a.StockReceiptID = b.StockReceiptID

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
			SELECT It.PreVoucherId,
				   It.RowNum,
				   it.InventorySlID,
				   InventoryDescription,
				   InventoryDescription2,
				   CASE WHEN it.EstimatedPrice >0 THEN it.EstimatedPrice ELSE it.InvoicePrice END  + it.ShareOfCosts ,
				   0,
				   -1,
				   1,
				   CASE WHEN it.EstimatedPrice >0 THEN it.EstimatedPrice ELSE it.InvoicePrice END  + it.ShareOfCosts ,
				   0,
				   1,
				   @CreatorId,
				   GETDATE(),
				   @CreatorId,
				   GETDATE(),
				   0,
				   'StockReceiptItem',
				   StockReceiptItemID
			FROM   #TempOfStockReceiptItems It
			
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
			SELECT IT.PreVoucherId,
				   RowNum,
				   case when BaseEntity = 10 then @OrderPricingSlID else it.SlID  end,
				   PurchaseControlDescription,
				   PurchaseControlDescription2,
				   0,
				   case when  it.EstimatedPrice > 0 then it.EstimatedPrice  else  it.InvoicePrice end, 
				   -1,
				   1,
				   0,
				   case when  it.EstimatedPrice > 0 then it.EstimatedPrice else it.InvoicePrice  end, 
				   1,
				   @CreatorId,
				   GETDATE(),
				   @CreatorId,
				   GETDATE(),
				   0,
				   'StockReceiptItem',
				   StockReceiptItemID
			FROM   #TempOfStockReceiptItems It
			join #StockReceipt st on st.StockReceiptID = It.StockReceiptID
			
			INSERT INTO ACC.PreVoucherItem
			(
			PreVoucherID,
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
		SELECT  PreVoucherId,
				RowNum,
				it.CreditInPurchaseSlID,
				Description,
				Description2,
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
				'ReceiptCost',
				ReceiptCostID
		FROM   #RCtemps It;

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
				   dl.DlID,
				   NULL,
				   @CreatorId,
				   GETDATE(),
				   @CreatorId,
				   GETDATE(),
				   0
		 from #TempOfStockReceiptItems h
		 join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID and a.BaseDocumentName = 'StockReceiptItem' and a.BaseDocumentID = h.StockReceiptItemID
		 join acc.accountlevelsl b on a.slid = b.slid 
		 join acc.DL  on dl.DLID = h.ContractDlID and dl.DlTypeID = b.DlTypeID		

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
				   ProformaDlID,
				   NULL,
				   @CreatorId,
				   GETDATE(),
				   @CreatorId,
				   GETDATE(),
				   0
			FROM    #RCtemps
			join acc.PreVoucherItem pvi on pvi.BaseDocumentName = 'ReceiptCost' and pvi.BaseDocumentID = #RCtemps.ReceiptCostID
			INNER JOIN Acc.AccountLevelSL als
				ON  als.SlID =   pvi.SlID
			join acc.dl on dl.DLID = #RCtemps.ProformaDlID and dl.DlTypeID = als.DlTypeID

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
				   PurchaseInvoiceDlID,
				   NULL,
				   @CreatorId,
				   GETDATE(),
				   @CreatorId,
				   GETDATE(),
				   0
			FROM    #RCtemps
			join acc.PreVoucherItem pvi on pvi.BaseDocumentName = 'ReceiptCost' and pvi.BaseDocumentID = #RCtemps.ReceiptCostID
			INNER JOIN Acc.AccountLevelSL als
				ON  als.SlID =   #RCtemps.CreditInPurchaseSlID
			join acc.dl on dl.DLID = #RCtemps.PurchaseInvoiceDlID and dl.DlTypeID = als.DlTypeID
			
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
			SELECT a.prevoucheritemid,
				   b.AccountLevelID,
				   DeliverDlID,
				   NULL,
				   @CreatorId,
				   GETDATE(),
				   @CreatorId,
				   GETDATE(),
				   0
		 from #StockReceipt h
		 join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
		 join acc.accountlevelsl b on a.slid = b.slid 
		 join acc.dl c on c.DLID = h.DeliverDlID and c.DlTypeID = b.DlTypeID
		 left join acc.PreVoucherItemAccountLevel pial on pial.PreVoucherItemID = a.PreVoucherItemID and pial.AccountLevelID = b.AccountLevelID
		 where pial.PreVoucherItemAccountLevelID is null

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
		 from #StockReceipt h
		 join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
		 join acc.accountlevelsl b on a.slid = b.slid 
		 join stc.StockReceiptDl c on c.StockReceiptID = h.StockReceiptID and c.DlTypeID = b.DlTypeID

		  DECLARE @TRACEID INT,@DlType int
		  DECLARE db_cursor CURSOR FOR
		  select TRACEID,DlTypeID
		  FROM STF.Trace 
		  WHERE DlTypeID IS NOT NULL
		
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
			SELECT pvi.PreVoucherItemID,
				   als.AccountLevelID,
				   a.'+QUOTENAME(@TRACEID)+',
				   NULL,
				   @pCreatorId,
				   GETDATE(),
				   @pCreatorId,
				   GETDATE(),
				   0
			FROM    #TempOfStockReceiptItems a
			join acc.PreVoucherItem pvi on pvi.BaseDocumentName = ''StockReceiptItem'' and pvi.BaseDocumentID = a.StockReceiptItemID
			INNER JOIN Acc.AccountLevelSL als ON  als.SlID =  pvi.SlID
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
					REPLACE([pi].Description,
						'@@StockTitle@@',i.StockTitle),	
						'@@ReceiptType@@',i.StockDocumentType),
						'@@DelivererName@@',ISNULL(i.DelivererName,'')),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey) [Description],
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@StockTitle@@',i.StockTitle2),	
						'@@ReceiptType@@',i.StockDocumentType2),
						'@@DelivererName@@',isnull(i.DelivererName2,'')),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)[Description2]
			from #StockReceipt i
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
					REPLACE([pi].Description,
						'@@StockTitle@@',i.StockTitle),	
						'@@ReceiptType@@',i.StockDocumentType),					
						'@@DelivererName@@',isnull(i.DelivererName,'')),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey) 		
		,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@StockTitle@@',i.StockTitle2),	
						'@@ReceiptType@@',i.StockDocumentType2),
						'@@DelivererName@@',isnull(i.DelivererName2,'')),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)
		from acc.PreVoucher pi
		join #StockReceipt i on pi.PrevoucherID = i.PrevoucherID
