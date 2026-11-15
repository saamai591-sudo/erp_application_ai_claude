
--------------------------------------------------------
CREATE    PROCEDURE [FIN].spPettyCashCostPreVoucherInsert
	@PettyCashCostId NVARCHAR(MAX)
	
	--WITH ENCRYPTION 
	 AS 

		DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'PettyCashCost'),											
				@MDEntity INT = (select Top 1 Id from mdt.DmdEntity AS de where Name = 'PettyCashCost'),
				@HeaderDescription NVARCHAR(MAX),
				@HeaderDescription2 NVARCHAR(MAX),
				@CostItemDescription NVARCHAR(MAX),
				@CostItemDescription2 NVARCHAR(MAX),
				@PettyCashDescription NVARCHAR(MAX),
				@PettyCashDescription2 NVARCHAR(MAX),
				@BaseDigit int,
				@MaxPrevoucherID int,
				@ContraParty int,
				@CreatorId int
			
		set @CreatorId = cfg.GetuserID();
		set @BaseDigit = cfg.GetBaseCurrencyPrecision();

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@PettyCashCostId) 	

		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @CostItemDescription = Description,
				@CostItemDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'CostItem'

		select  @PettyCashDescription = Description,
				@PettyCashDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'PettyCash'   


			 
		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
		--- FetchValues ---
		SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by PettyCashCostID) PrevoucherID,	
				PettyCashCostID,
				PCC.Number,
				pcc.CurrencyRate,
				pc.CurrencyID,
				case when pc.HasBankPettyCash =1 then ba.DlID else p.DlID end DlID,
				pcc.BranchID,
				PCC.FinancialPeriodID,
				case when pc.HasBankPettyCash = 1 then ba.SLID else pc.SLID end SlID ,
				pcc.Date,
				c.ExchangeUnit,
				c.IsBaseCurrencyBasis,
				@HeaderDescription Description,
				@HeaderDescription2 Description2,
				cast(null as varchar(max)) ErrorMessage,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey,
				f.Title PettyCashTitle,
				f.Title2 PettyCashTitle2,
				f.DlID FundDlID,
				p.Title + isnull(' '+LastName,'') PettyCashier,
				p.Title2 + isnull(' '+LastName2,'') PettyCashier2,
				pcc.Description HeaderDescription,
				pcc.Description2 HeaderDescription2,
				pcc.Status,
				case when pc.HasBankPettyCash = 1 then ba.DlID else Null end BankPettyCashDlID,
				HasBankPettyCash
		   into #PettyCashCost
		FROM   FIN.PettyCashCost PCC
		join FIN.PettyCash pc on pc.PettyCashID = PCC.PettyCashID
		left join cfg.BankAccount ba on pc.BankAccountID = ba.BankAccountID
		join fin.Fund f on f.FundID = pc.FundID
		join cfg.Party p on p.PartyID = pc.PartyID
		join cfg.Currency c on c.CurrencyID = pc.CurrencyID
		JOIN #DocumentIds b on PCC.PettyCashCostID = b.ID
		JOIN cfg.DimDate DD on DD.Date = PCC.Date
		WHERE PCC.PreVoucherID is null  


		update a
		set ErrorMessage =  N'ابتدا صورتخلاصه را تایید نمایید.'+char(10)+char(13)
		from #PettyCashCost a
		WHERE Status <> 2

		update a
		set ErrorMessage = isnull(ErrorMessage,'')+ N'برای تنخواه دار انتخاب شده، حساب معین تنخواه تعیین نشده است.'+char(10)+char(13)
		from #PettyCashCost a
		WHERE HasBankPettyCash = 0 and SLID is null

		update a
		set ErrorMessage = isnull(ErrorMessage,'')+ N'برای بانک منسوب به این تنخواه دار، حساب معین موجودی بانک تعیین نشده است.'+char(10)+char(13)
		from #PettyCashCost a
		WHERE HasBankPettyCash = 1 and SLID is null


		if exists (select * from #PettyCashCost where ErrorMessage is not null )
		BEGIN	
			select PettyCashCostID,ErrorMessage from #PettyCashCost
			RETURN;
		END

	select      PettyCashCostItemID,
				h.PettyCashCostID,
				h.PrevoucherID,
				h.CurrencyID,
				h.CurrencyRate,
				case when PurchaseType.SlID is not null then PurchaseType.SlID 
					 when SaleType.SlID is not null then SaleType.SlID
					 when SaleType2.SlID is not null then SaleType2.SlID
				else t.SlID end SlID,
				case
					when h.IsBaseCurrencyBasis = 0
						then ROUND(Amount*h.currencyrate/h.ExchangeUnit , @BaseDigit)
					when h.IsBaseCurrencyBasis = 1
						then ROUND(Amount*h.ExchangeUnit / h.currencyrate, @BaseDigit)
					end AmountInBaseCurrency,
				Amount,
				REPLACE(
				@CostItemDescription,'@@ItemDescription@@',isnull(I.Description,'')) DESCRIPTION,
				REPLACE(
				@CostItemDescription2,'@@ItemDescription@@',isnull(I.Description2,'')) DESCRIPTION2
			into #TempPettyCashCostItem
		from #PettyCashCost h
		join fin.PettyCashCostItem i on i.PettyCashCostID = h.PettyCashCostID
		join fin.PaymentType t on t.PaymentTypeID = i.PaymentTypeID
		left join vnd.PurchaseInvoice pi on pi.PurchaseInvoiceID = i.PurchaseInvoiceID
		left join vnd.PurchaseType on PurchaseType.PurchaseTypeID = pi.Type
		left join sle.ReturnedSaleInvoice on ReturnedSaleInvoice.ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID
		left join sle.SaleType on SaleType.SaleTypeID = ReturnedSaleInvoice.SaleTypeID
		left join sle.Invoice on Invoice.InvoiceID = i.InvoiceID
		left join sle.SaleType SaleType2 on SaleType2.SaleTypeID = Invoice.SaleTypeID
			
		update a
		set ErrorMessage =  N'FIN_spPettyCashCostPreVoucherInsert_2'+char(10)+char(13)
		from #PettyCashCost a
		join #TempPettyCashCostItem b on a.PettyCashCostID = b.PettyCashCostID
		WHERE b.SlID IS NULL


		if exists (select * from #PettyCashCost where ErrorMessage is not null )
		BEGIN	
			select PettyCashCostID,ErrorMessage from #PettyCashCost
			RETURN;
		END

		   
		CREATE TABLE #Allocation
				(
				DebitCreditNoteID int,
				PrevoucherID int,
				DebitCreditNoteItemID INT,
				CurrencyID INT,
				CurrencyRate DECIMAL(36,10),
				Debit DECIMAL(36,10),
				CurrencyDebit DECIMAL(36,10),
				Credit DECIMAL(36,10),
				CurrencyCredit DECIMAL(36,10),
				SlID INT,
				DlID INT,
				Description nvarchar(max),
				Description2 nvarchar(max),
				PreVoucherItemID int,
				RowIndex int
				)

		INSERT INTO #Allocation
		SELECT 
				pr.PettyCashCostID,
				pr.PrevoucherID,
				ps.PettyCashCostItemID,
				pr.CurrencyID,
				0,
				case when ps.Allocation > 0 then ps.Allocation else 0 end,
				0,
				case when ps.Allocation > 0 then 0 else abs(ps.Allocation) end,
				0,
				PT.SLID,
				p.DlID,
				N'بابت تسعیر ارز',
				N'بابت تسعیر ارز',
				null,
				ps.RowIndex
		FROM fin.PettyCashCostItem  ps 
		join #PettyCashCost pr     on pr.PettyCashCostID = ps.PettyCashCostID
		left join fin.PaymentType PT on Pt.PaymentTypeID = ps.PaymentTypeID
		left join cfg.Party p on p.PartyID = ps.PartyID
		where ps.Allocation <> 0

		INSERT INTO #Allocation
		SELECT 
				pr.PettyCashCostID,
				pr.PrevoucherID,
				ps.PettyCashCostItemID,
				-1,
				1,
				case when ps.Allocation > 0 then 0 else abs(ps.Allocation) end,
				case when ps.Allocation > 0 then 0 else abs(ps.Allocation) end,
				case when ps.Allocation > 0 then ps.Allocation else 0 end,
				case when ps.Allocation > 0 then ps.Allocation else 0 end,
				PT.AllocationSlID,
				p.DlID,
				N'بابت تسعیر ارز',
				N'بابت تسعیر ارز',
				null,
				ps.RowIndex
		FROM fin.PettyCashCostItem  ps 
		join #PettyCashCost pr     on pr.PettyCashCostID = ps.PettyCashCostID
		left join fin.PaymentType PT on Pt.PaymentTypeID = ps.PaymentTypeID
		left join cfg.Party p on p.PartyID = ps.PartyID
		where ps.Allocation <> 0
		-- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on		
		INSERT INTO [ACC].[PreVoucher]([PreVoucherID],BranchID,[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchID,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,getdate(),0
		from #PettyCashCost
		set identity_insert [ACC].[PreVoucher] off
		
		UPDATE a
		SET    PreVoucherID = b.PreVoucherId
		from FIN.PettyCashCost a
		join #PettyCashCost b on a.PettyCashCostID = b.PettyCashCostID
		
	 
		-- Insert debit
		INSERT INTO ACC.PreVoucherItem 
				(
					PreVoucherID ,
					RowIndex	   ,
					SlID           ,
					DESCRIPTION , 
					Description2,
					Debit,			                
					Credit,
					CurrencyID ,
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
					BaseDocumentID)
		SELECT	
			PreVoucherId,
			1,
			DCNI.SlID,
			DESCRIPTION , 
			DESCRIPTION2,
			DCNI.AmountInBaseCurrency,
			0,
			CurrencyID , 
			CurrencyRate, 
			DCNI.Amount, 
			0,
			1,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0			,
			'PettyCashCostItem',
			PettyCashCostItemID
		from #TempPettyCashCostItem DCNI
	  

		INSERT INTO ACC.PreVoucherItem 
					(
					PreVoucherID ,
					RowIndex	   ,
					SlID           ,
					DESCRIPTION , 
					Description2,
					Debit,			                
					Credit,
					CurrencyID ,
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
					BaseDocumentID)
		SELECT	
			PreVoucherId,
			1,
			SliD,
			@PettyCashDescription , 
			@PettyCashDescription2 , 
			0,
			b.AmountInBaseCurrency,
			CurrencyID , 
			CurrencyRate, 
			0, 
			b.Amount,
			1,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0,
			'PettyCashCost',
			a.PettyCashCostID
		from #PettyCashCost a
		join (
			select PettyCashCostID,sum(Amount) Amount,SUM(AmountInBaseCurrency) AmountInBaseCurrency
			from #TempPettyCashCostItem
			group by PettyCashCostID
			) b on a.PettyCashCostID = b.PettyCashCostID
	  
	 
	INSERT INTO ACC.PreVoucherItem 
			(
			PreVoucherID ,
			RowIndex	   ,
			SlID           ,
			DESCRIPTION , 
			Description2,
			Debit,			                
			Credit,
			CurrencyID ,
			CurrencyRate, 
			CurrencyDebit, 
			CurrencyCredit,
			Creator,  
			CreationDate,
			LastEditor,
			LastEditionDate,
			Version,
			BaseDocumentName,
			BaseDocumentID)
		SELECT							
			PreVoucherId,
			1,
			SlID,
			Description,
			Description2,
			Debit,	
			Credit,		
			CurrencyID,
			CurrencyRate,
			CurrencyDebit,	
			CurrencyCredit, 		           
			@CreatorId,
			GETDATE(),   
			@CreatorId,       
			GETDATE(),        
			0,
			'Allocation',
			DebitCreditNoteItemID
		FROM #Allocation 
		order by Debit desc

		INSERT INTO ACC.PreVoucherItemAccountLevel
		SELECT pvi.PreVoucherItemID,
			   a.AccountLevelID,              
			   dl.DlID,
			   null,
			   @CreatorId,
			   GETDATE(),
			   @CreatorId,
			   GETDATE(),
			   0
		from #Allocation temp
		join acc.PreVoucherItem pvi on pvi.PreVoucherID = temp.PrevoucherID and pvi.BaseDocumentName = 'Allocation' and pvi.BaseDocumentID = temp.DebitCreditNoteItemID and pvi.SlID = temp.SlID
		join acc.AccountLevelSL a on a.SlID = temp.SlID
		join acc.DL dl on dl.DLID = temp.DlID and dl.DlTypeID = a.DlTypeID
		
	   INSERT INTO ACC.PreVoucherItemAccountLevel
		SELECT pvi.PreVoucherItemId,
			   dcni.AccountLevelID,
			   case when dcni.DlID IS not null then dcni.DlID else null end,
			   case when dcni.DlID IS null then  dcni.Value else null end,
			   @CreatorId,
			   GETDATE(),
			   @CreatorId,
			   GETDATE(),
			   0
		from #TempPettyCashCostItem temp
		join acc.PreVoucherItem pvi on pvi.BaseDocumentName = 'PettyCashCostItem' and pvi.BaseDocumentID = temp.PettyCashCostItemID
		join FIN.PettyCashCostItemAccountLevel dcni on dcni.PettyCashCostItemID = temp.PettyCashCostItemID
		 

		INSERT INTO [ACC].[PreVoucherItemAccountLevel]
		   ([PreVoucherItemID]
		   ,[AccountLevelID]
		   ,[DlID]
		   ,[Value]
		   ,[Creator]
		   ,[CreationDate]
		   ,[LastEditor]
		   ,[LastEditionDate]
		   ,[Version])
		SELECT	
			a.PreVoucherItemID,
			b.AccountLevelID,
			h.DlID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
		 from #PettyCashCost h
		 join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
		 join acc.accountlevelsl b on a.slid = b.slid 
		 join acc.dl c on c.DLID = h.DlID and c.DlTypeID = b.DlTypeID	
		 left join acc.PreVoucherItemAccountLevel pal on pal.PreVoucherItemID = a.PreVoucherItemID and pal.AccountLevelID = b.AccountLevelID 
		 where pal.PreVoucherItemAccountLevelID is null

		INSERT INTO [ACC].[PreVoucherItemAccountLevel]
		   ([PreVoucherItemID]
		   ,[AccountLevelID]
		   ,[DlID]
		   ,[Value]
		   ,[Creator]
		   ,[CreationDate]
		   ,[LastEditor]
		   ,[LastEditionDate]
		   ,[Version])
		SELECT	
			a.PreVoucherItemID,
			b.AccountLevelID,
			c.DlID,
			NULL,
			@CreatorId,
			GETDATE(),
			@CreatorId,
			GETDATE(),
			0		
		 from #PettyCashCost h
		 join acc.prevoucheritem a on h.PrevoucherID = a.PreVoucherID
		 join acc.accountlevelsl b on a.slid = b.slid 
		 join acc.dl c on c.DLID = h.FundDlID and c.DlTypeID = b.DlTypeID	
		 left join acc.PreVoucherItemAccountLevel pal on pal.PreVoucherItemID = a.PreVoucherItemID and pal.AccountLevelID = b.AccountLevelID 
		 where pal.PreVoucherItemAccountLevelID is null
 

		update I
		set ErrorMessage =  N'مقدار شرح صورتخلاصه وارد نشده است.'+char(10)+char(13)
		from #PettyCashCost i
		join  acc.PreVoucherItem [pi]  on [pi].PrevoucherID = i.PreVoucherID
		WHERE [pi].Description LIKE '@@HeaderDescription@@'
		AND I.HeaderDescription IS NULL

		if exists (select * from #PettyCashCost where ErrorMessage is not null )
		BEGIN	
			select PettyCashCostID,ErrorMessage from #PettyCashCost
			RETURN;
		END

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
						'@@HeaderDescription@@',ISNULL(i.HeaderDescription,'')),		
						'@@PettyCashier@@',i.PettyCashier),					
						'@@PettyCashTitle@@',i.PettyCashTitle),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey) [Description],
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE(
					REPLACE([pi].Description2,
						'@@HeaderDescription@@',ISNULL(i.HeaderDescription2,'')),		
						'@@PettyCashier@@',i.PettyCashier2),		
						'@@PettyCashTitle@@',i.PettyCashTitle2),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)[Description2]
			from #PettyCashCost i
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
						'@@HeaderDescription@@',i.HeaderDescription),		
						'@@PettyCashier@@',i.PettyCashier),		
						'@@PettyCashTitle@@',i.PettyCashTitle),
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
						'@@HeaderDescription@@',i.HeaderDescription2),		
						'@@PettyCashier@@',i.PettyCashier2),	
						'@@PettyCashTitle@@',i.PettyCashTitle2),
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',FullDateAlternateKey),
						'@@Date_Solar@@',PersianFullDateAlternateKey)
		from acc.PreVoucher pi
		join #PettyCashCost i on pi.PrevoucherID = i.PrevoucherID
