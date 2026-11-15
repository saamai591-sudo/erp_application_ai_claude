CREATE PROC CFG.RPT_SaleAndPurchaseBill
(
    @FromDate DATE,
    @ToDate DATE,
    @Type VARCHAR(20),
    @PartyID BIGINT = NULL,
    @CurrencyID INT = NULL,
    @SelectedVendorGroups VARCHAR(1024) = NULL,
    @SelectedCustomerGroups VARCHAR(1024) = NULL
)
--with encryption
AS
BEGIN
    DECLARE @Culture VARCHAR(25),
            @TableName NVARCHAR(MAX),
            @CultureNo TINYINT,
            @Query NVARCHAR(MAX),
            @TableName2 NVARCHAR(MAX),
            @TableName3 NVARCHAR(MAX);

    SET @Culture = CFG.GetuserCulture();
    SET @TableName = CFG.getTempTableName(1);
    SET @TableName2 = CFG.getTempTableName(1);
    SET @TableName3 = CFG.getTempTableName(1);

    SELECT value GroupID
    INTO #VendorGroups
    FROM CFG.R_FnCommaStr2Table(@SelectedVendorGroups);

    SELECT LEFT(GroupID, CHARINDEX('_', GroupID) - 1) AS GroupID,
           SUBSTRING(GroupID, CHARINDEX('_', GroupID) + 1, LEN(GroupID)) CurrencyID
    INTO #SelectedVendorGroups
    FROM #VendorGroups;

    SELECT value GroupID
    INTO #CustomerGroups
    FROM CFG.R_FnCommaStr2Table(@SelectedCustomerGroups);

    SELECT LEFT(GroupID, CHARINDEX('_', GroupID) - 1) AS GroupID,
           SUBSTRING(GroupID, CHARINDEX('_', GroupID) + 1, LEN(GroupID)) CurrencyID
    INTO #SelectedCustomerGroups
    FROM #CustomerGroups;

    SET @Query = N'
		IF OBJECT_ID(''tempdb..' + @TableName + N''') IS NOT NULL 
		drop table ' + @TableName;

    EXEC (@Query);

    SET @Query
        = N'
			create table ' + @TableName
          + N'(
				CurrencyID int,
				PartyID bigint,			
				OpeningBalance decimal(30,4),
				Price decimal(30,4),
				Discount decimal(30,4),
				Vat  decimal(30,4),
				Returned decimal(30,4),
				Received decimal(30,4),
				Payed decimal(30,4),
				ReportType nvarchar(10),
				DataType tinyint
			)';

    EXEC (@Query);

    SET @Query
        = N'
			create table ' + @TableName2
          + N'
		(
			CurrencyID int,
			PartyID int,
			OpeningBalance decimal(30,4),
			Price decimal(30,4),
			Discount decimal(30,4),
			Vat  decimal(30,4),
			Returned decimal(30,4),
			Received decimal(30,4),
			Payed decimal(30,4),
			ReportType nvarchar(10),
			Sale decimal(30,4),
			Purchase decimal(30,4)
		)';

    EXEC (@Query);

    SET @Query
        = N'
			create table ' + @TableName3
          + N'
		(
			CurrencyID int,
			PartyID int,
			OpeningBalance decimal(30,4),
			Price decimal(30,4),
			Discount decimal(30,4),
			Vat  decimal(30,4),
			Returned decimal(30,4),
			Received decimal(30,4),
			Payed decimal(30,4),
			Sale decimal(30,4),
			Purchase decimal(30,4)
		)';

    EXEC (@Query);

    EXEC CFG.SpSaleAndPurchaseSummaryDataSource NULL,
                                                @FromDate,
                                                @PartyID,
                                                @CurrencyID,
                                                @TableName,
                                                @Type,
                                                0;

    EXEC CFG.SpSaleAndPurchaseSummaryDataSource @FromDate,
                                                @ToDate,
                                                @PartyID,
                                                @CurrencyID,
                                                @TableName,
                                                @Type,
                                                1;

    SET @Query
        = N' Insert into ' + @TableName2
          + N'
		(
			CurrencyID ,
			PartyID, 			
			OpeningBalance ,
			Price ,
			Discount ,
			Vat ,
			Returned ,
			Received,
			Payed,
			Sale,Purchase 
		)
		select 
			 CurrencyID ,
			 PartyID,
			sum(OpeningBalance+Price+Discount+Vat+Returned+Received+Payed) ,
			0 Price ,
			0 Discount ,
			0 Vat ,
			0 Returned ,
			0 Received,
			0 Payed,
			0,0   from ' + @TableName + N' a 			
			 Where DataType = 0 and (ReportType=''' + @Type + N''' or ''' + @Type
          + N'''=''Party'') Group by PartyID ,CurrencyID,ReportType ';

    EXEC (@Query);

    SET @Query
        = N' Insert into ' + @TableName2
          + N'
	(		
		CurrencyID ,
		PartyID, 			
		OpeningBalance ,
		Price ,
		Discount ,
		Vat ,
		Returned ,
		Received,
		Payed,
		Sale,
		Purchase 
	)
	select 
		CurrencyID ,
		PartyID,
		0,
		sum(price) Price ,
		sum(Discount) Discount ,
		sum(Vat) Vat ,
		sum(Returned) Returned ,
		sum(Received) Received,
		sum(Payed) Payed,sum(Case when a.ReportType=''Customer'' then a.Price+a.Discount+a.Vat+a.Returned else 0 end) Sale,
		sum(Case when a.ReportType=''Vendor'' then a.Price+a.Discount+a.Vat+a.Returned else 0 end) Purchase
	from '       + @TableName + N' a 
			
			 Where DataType = 1 and (ReportType=''' + @Type + N''' or ''' + @Type
          + N'''=''Party'') Group by PartyID ,CurrencyID,	ReportType ';

    EXEC (@Query);

    --Print 333
    SET @Query
        = N' Insert into ' + @TableName3
          + N'
			(	CurrencyID ,
				PartyID,
				OpeningBalance ,
				Price ,
				Discount ,
				Vat ,
				Returned ,
				Received,
				Payed,
				Sale,
				Purchase
			)
				select 
					a.CurrencyID ,
					a.PartyID,
					Sum(OpeningBalance) as OpeiningBalance ,
					Sum(Price) Price ,
					Sum( Discount) ,
					Sum( Vat) ,
					Sum( Returned) ,
					Sum( Received),
					Sum( Payed),Sum(Sale),Sum(Purchase) from ' + @TableName2 + N' a '
          + CASE
                WHEN @SelectedVendorGroups IS NOT NULL
                     OR @SelectedCustomerGroups IS NOT NULL THEN
                    N' 
					join cfg.Party p on a.partyID = p.partyId '
                ELSE
                    ''
            END
          + CASE
                WHEN @SelectedVendorGroups IS NOT NULL THEN
                    N' 
					join #SelectedVendorGroups vg on p.VendorGroupId = vg.GroupID and a.CurrencyID = vg.CurrencyID '
                ELSE
                    ''
            END + N' '
          + CASE
                WHEN @SelectedCustomerGroups IS NOT NULL THEN
                    N' 
					join #SelectedCustomerGroups cg on p.CustomerGroupID = cg.GroupID and a.CurrencyID = cg.CurrencyID '
                ELSE
                    ''
            END + N' 
			Group by a.PartyID,a.CurrencyID';
    --Print 334
    EXEC (@Query);
    --Print @Query

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    IF @Type <> 'Party'
    BEGIN
        SET @Query
            = N'
				select row_number() OVER (ORDER BY a.PartyID,a.CurrencyID) ID,
						a.PartyID,
						a.CurrencyID,
						dl.Code,
						dl.Title,
						dl.Title2,
						case when @CultureNo = 1 then c.Title else c.Title2 end as Currency,
						OpeningBalance,
						a.Price Sale,
						a.Returned,
						a.Discount,
						a.Vat,
						a.price+a.Returned+a.Discount+a.Vat Net,
						a.Received,
						a.Payed,
						OpeningBalance+a.Price +a.Returned + a.Discount	+a.Vat+	a.Received + a.Payed Remain
				from  ' + @TableName3
              + N' a
					join cfg.Party p on a.PartyID = p.PartyID
					join cfg.Currency c on c.CurrencyID = a.CurrencyID
					join acc.dl on dl.DLID = p.DlID			';
    END;
    ELSE
    BEGIN
        SET @Query
            = N'	select row_number() OVER (ORDER BY a.PartyID,a.CurrencyID)  ID,
						a.PartyID,
						a.CurrencyID,
						dl.Code,
						dl.Title,
						dl.Title2,
						case when @CultureNo = 1 then c.Title else c.Title2 end as Currency,
						a.OpeningBalance,
						a.Sale,
						a.Purchase,
						a.Received,
						a.Payed,
						(a.OpeningBalance+a.Sale+a.Purchase+a.Received+a.Payed) Remain
				from  ' + @TableName3
              + N' a
					join cfg.Party p on a.PartyID = p.PartyID
					join cfg.Currency c on c.CurrencyID = a.CurrencyID
					join acc.dl on dl.DLID = p.DlID	';
    END;

    EXECUTE sys.sp_executesql @Query,
                              N'@CultureNo  TINYINT,@Type varchar(20)',
                              @CultureNo = @CultureNo,
                              @Type = @Type;
END;
