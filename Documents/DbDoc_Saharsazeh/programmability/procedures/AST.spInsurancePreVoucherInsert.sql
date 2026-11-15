
-------------------------------------
CREATE   PROCEDURE [AST].spInsurancePreVoucherInsert
	@InsuranceID NVARCHAR(MAX)
--WITH ENCRYPTION 
	 AS 

	    DECLARE @DocumentNumTypeId  INT = (SELECT DocumentNumTypeID  FROM   CFG.DocumentNumType  WHERE EngName = 'Insurance'),
	            @MDEntity INT = (select Top 1 de.ID from mdt.DmdEntity AS de where de.Name = 'Insurance'),
		        @HeaderDescription NVARCHAR(MAX),
				@HeaderDescription2 NVARCHAR(MAX),
	            @PayableAccountsDescription NVARCHAR(MAX),
				@PayableAccountsDescription2 NVARCHAR(MAX),
	            @DownPaymentDescription NVARCHAR(MAX),
				@DownPaymentDescription2 NVARCHAR(MAX),
				@BaseDigit int,
				@MaxPrevoucherID int,
				@CreatorId int,
				@Culture VARCHAR(10),
				@CultureNo TINYINT;
	        
		set @CreatorId = cfg.GetuserID();
		SET @Culture = CFG.GetuserCulture();

		select @CultureNo = CultureNo
		from cfg.CultureInfo
		where Culture = @Culture;

		set @BaseDigit = cfg.GetBaseCurrencyPrecision();

		SELECT [value] ID
		INTO #DocumentIds
		FROM   cfg.R_FnCommaStr2Table(@InsuranceID) 	

		select  @HeaderDescription = Description,
				@HeaderDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'Header'

		select  @PayableAccountsDescription = Description,
				@PayableAccountsDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'PayableAccounts'

		select  @DownPaymentDescription = Description,
				@DownPaymentDescription2 = Description2
		from CFG.[VoucherDescription] 
		where MDEntityID = @MDEntity and [Key] = 'DownPayment'  
	  	    
		select @MaxPrevoucherID = MAX(PreVoucherID)
		from acc.PreVoucher
	    --- FetchValues ---
	    SELECT  isnull(@MaxPrevoucherID,0) + ROW_NUMBER() over(order by i.InsuranceID) PrevoucherID,	
				i.InsuranceID,
				i.FinancialPeriodID,
				i.Price,
				p.DlID,
				i.date,
				it.Title InsuranceType,
				i.PurchaseInvoiceItemID,
				i.BranchID,
				i.Insurancetypeid,
				it.PrepaidInsurance SlID,
				cast(null as varchar(max)) ErrorMessage,
				@HeaderDescription Description,
				@HeaderDescription2 Description2,
				sd.SlID PurchaseControlSlID			,
				i.Number,
				dd.FullDateAlternateKey,
				dd.PersianFullDateAlternateKey
			into #Insurance
	    FROM   AST.Insurance i
		join cfg.Party p on p.PartyID = i.PartyID
		join ast.InsuranceType it on it.InsuranceTypeID = i.InsuranceTypeID
		JOIN #DocumentIds b on i.InsuranceID = b.ID
		JOIN cfg.DimDate DD on DD.Date = i.Date
		left join vnd.PurchaseInvoiceItem pii on pii.PurchaseInvoiceItemID = i.PurchaseInvoiceItemID
		left join stf.StuffDetail sd	on sd.StuffID = pii.StuffID
	    WHERE i.PreVoucherID is null     

		update a
		set ErrorMessage = 'در نوع بیمه '+InsuranceType+' معین پیش پرداخت بیمه مشخص نشده است.'+char(10)+char(13)
		from #Insurance a
		WHERE SlID IS NULL

		update a
		set ErrorMessage = isnull(ErrorMessage,'') + 'در برخی از خدمات خریداری شده معین خرید مشخص نشده است.'+char(10)+char(13)
		from #Insurance a
		WHERE PurchaseControlSlID IS NULL

		if exists (select * from #Insurance where ErrorMessage is not null )
		BEGIN	
			select InsuranceID,ErrorMessage from #Insurance
			RETURN;
	    END

		select 
			h.SlID,
			h.PurchaseControlSlID,
			round(h.Price * (ii.EstimatedValue / es.SumEstimatedValue),@BaseDigit) ShareOfPrice,
			h.InsuranceID,
			h.PrevoucherID,
			ii.InsuranceItemID,
			@DownPaymentDescription Description,
			@DownPaymentDescription2 Description2,
			@PayableAccountsDescription PayableAccountsDescription ,
			@PayableAccountsDescription2 PayableAccountsDescription2
		 into #PreVoucherItemTemp
		from ast.InsuranceItem ii
		join ast.Asset a on ii.AssetID = a.AssetID
		join #Insurance h on h.Insuranceid = ii.Insuranceid
		join
		(
		select InsuranceID,sum(EstimatedValue) SumEstimatedValue
		from ast.InsuranceItem
		group by InsuranceID
		)es on es.InsuranceID = h.InsuranceID

		;with cte 
		as
		(
		select c.InsuranceItemID,a.Price - b.TotalShare Diff
		from #Insurance a
		join 
		(
		select InsuranceID,sum(ShareOfPrice) TotalShare
		from #PreVoucherItemTemp
		group by InsuranceID
		)b on a.InsuranceID = b.InsuranceID
		join 
		(
		select  InsuranceItemID,
				InsuranceID,
				ROW_NUMBER() over(partition by InsuranceID order by ShareOfPrice desc) Rno
		from #PreVoucherItemTemp
		)c on c.Rno = 1 and c.InsuranceID = a.InsuranceID
		where a.Price <> b.TotalShare
		)



		update a
		set ShareOfPrice = a.ShareOfPrice + cte.Diff
		from #PreVoucherItemTemp a
		join cte on cte.InsuranceItemID = a.InsuranceItemID
	     	    
	    -- Insert Into PreVoucher Tabel
		set identity_insert [ACC].[PreVoucher] on	
	    INSERT INTO [ACC].[PreVoucher]([PreVoucherID],[BranchID],[DocumentNumtypeID],[Date],[FinancialPeriodID],[Description],[Description2],[Creator],[CreationDate],[LastEditor],[LastEditionDate],[Version])
		SELECT [PreVoucherID],BranchID,@DocumentNumTypeId,date,FinancialPeriodID,Description,Description2,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0
		from #Insurance
		set identity_insert [ACC].[PreVoucher] off
	    
	    UPDATE a
	    SET    PreVoucherID = b.PreVoucherId
		from ast.Insurance a
		join #Insurance b on a.InsuranceID = b.InsuranceID
	    
	    INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
	    SELECT							PreVoucherId,1,SlID,Description,Description2,ShareOfPrice,0,-1,1,ShareOfPrice,0,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,'InsuranceItem',InsuranceItemID
	    from #PreVoucherItemTemp
		INSERT INTO ACC.PreVoucherItem (PreVoucherID ,RowIndex,SlID,DESCRIPTION , Description2,Debit,Credit,CurrencyID ,CurrencyRate, CurrencyDebit, CurrencyCredit,Creator,  CreationDate,LastEditor,LastEditionDate,Version,BaseDocumentName,BaseDocumentID)
		SELECT							PreVoucherId,1,PurchaseControlSlID,PayableAccountsDescription,PayableAccountsDescription2,0,ShareOfPrice,-1,1,0,ShareOfPrice,@CreatorId,GETDATE(),@CreatorId,GETDATE(),0,'InsuranceItem',InsuranceItemID
		from #PreVoucherItemTemp
		INSERT INTO [ACC].[PreVoucherItemAccountLevel]
           ([preVoucherItemID]
           ,[AccountLevelID]
           ,[DlID]
           ,[Value]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])
		select b.PreVoucherItemID
           ,s.[AccountLevelID]
           ,a.DlID
           ,null
           ,@CreatorId
           ,GETDATE()
           ,@CreatorId
            ,GETDATE()
           ,0
		   from #Insurance a
		   join acc.PreVoucherItem b on a.PrevoucherID = b.PreVoucherID
		   join acc.dl dl on dl.DLID = a.DlID
		   join acc.AccountLevelSL s on s.SlID = b.SlID and dl.DlTypeID = s.DlTypeID

		;with temp as 
		(
			select  [pi].PreVoucherItemID,
					ROW_NUMBER() over(partition by pi.PreVoucherID order by pi.PreVoucherItemID) RowIndex,
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey) [Description],
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description2,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey)[Description2]
			from #Insurance i
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
						[pi].Description,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey)		
		,
			[Description2] =
					REPLACE(
					REPLACE(
					REPLACE(
						[pi].Description2,
						'@@Number@@',i.Number),
						'@@Date_Gregorian@@',i.FullDateAlternateKey),
						'@@Date_Solar@@',i.PersianFullDateAlternateKey)
		from acc.PreVoucher pi
		join #Insurance i on pi.PrevoucherID = i.PrevoucherID
