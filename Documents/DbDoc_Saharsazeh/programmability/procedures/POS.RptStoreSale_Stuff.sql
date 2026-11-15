
CREATE   PROC [POS].RptStoreSale_Stuff
    (
        @FromDate DATE ,
        @EndDate DATE ,
        @Branch NVARCHAR(MAX) = NULL ,
        @Customer NVARCHAR(MAX) = NULL ,
        @SelectedSaleModels NVARCHAR(MAX) = NULL ,
        @SelectedSaleGroup NVARCHAR(MAX) = NULL ,
        @SelectedIds NVARCHAR(MAX) = NULL ,
        @SelectedCustomerGroup NVARCHAR(MAX) = NULL ,
        @SelectedShift NVARCHAR(MAX) = NULL
    )
--WITH ENCRYPTION
AS
    SELECT RIGHT(value, LEN(value) - 1) VALUE
    INTO   #Invoice
    FROM   CFG.R_FnCommaStr2Table(@SelectedIds)
    WHERE  LEFT(VALUE, 1) = 'I';

    SELECT RIGHT(value, LEN(value) - 1) VALUE
    INTO   #ReturnedInvoice
    FROM   CFG.R_FnCommaStr2Table(@SelectedIds)
    WHERE  LEFT(VALUE, 1) = 'R';

    DECLARE @Stuff NVARCHAR(100) ,
            @Service NVARCHAR(100),
            @order NVARCHAR(100),
			@Culture varchar(25),
		    @CultureNo tinyint

	set @Culture = CFG.GetuserCulture() 

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

    SELECT @Stuff = lev.[Value]
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'StuffType'
           AND le.Item = 'Stuff'
           AND lev.Culture = @Culture

    SELECT @Service = lev.[Value]
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'StuffType'
           AND le.Item = 'Service'
           AND lev.Culture = @Culture

    SELECT @order = lev.[Value]
    FROM   CFG.LocalizeEnum le
           JOIN CFG.LocalizeEnumValue lev ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE  le.Enum = 'StuffType'
           AND le.Item = 'StoreProduction'
           AND lev.Culture = @Culture

    DECLARE @UserID INT = CFG.GetuserID();

		
	SELECT * INTO #vwStationShiftAccess FROM cfg.vwStationShiftAccess
	

    SELECT result.StuffType ,
           result.StuffID ,
           result.Stuff1Code ,
           result.TechnicalCode ,
           result.Stuff1Title ,
           result.Mainunit ,
           result.Subunit ,
           result.MainQuantity ,
           result.SubQuantity ,
           result.SalePrice ,
           result.ReturnPrice ,
           result.Discount ,
           result.Net ,
           result.Tax ,
           result.Duty ,
           result.Net - result.Cost AS StorProfit,
           result.StuffBarcode,
           result.UniqueTaxID
    FROM   (   SELECT CASE WHEN stf.[Type] = 0 THEN @Stuff
                           WHEN stf.[Type] = 1 THEN @Service
                           WHEN stf.[Type] = 2 THEN @order
                      END StuffType ,   
                      temp.StuffID ,
                      stf.Code Stuff1Code ,                      
					  case when @CultureNo = 1 then stf.Title
	                       when @CultureNo = 2 then stf.Title2
	                  end as Stuff1Title,
                      stf.TechnicalCode ,                      
					  case when @CultureNo = 1 then MainMeasureUnit
	                       when @CultureNo = 2 then MainMeasureUnit2
	                  end as Mainunit,                      
					  case when @CultureNo = 1 then SubMeasureUnit
	                       when @CultureNo = 2 then SubMeasureUnit2
	                  end as Subunit,
                      ISNULL(SaleMain + ReturnMain, 0) MainQuantity ,
                      ISNULL(SaleSub + ReturnSub, 0) SubQuantity ,
                      ISNULL(SalePrice, 0) SalePrice ,
                      ISNULL(ReturnPrice, 0) ReturnPrice ,
                      ISNULL(- ( SaleDiscount + ReturnDiscount ), 0) Discount ,
                      ISNULL(
                          SalePrice + ReturnPrice
                          - ( SaleDiscount + ReturnDiscount ) ,
                          0) Net ,
                      ISNULL(SaleTax + ReturnTax, 0) Tax ,
                      ISNULL(SaleDuty + ReturnDuty, 0) Duty ,
                      ISNULL(temp.SaleCost + temp.ReturnCost, 0) Cost,
                      stf.Barcode AS StuffBarcode,
                      stf.UniqueTaxID AS UniqueTaxID
               FROM   STF.VWStuff stf
                      JOIN (   SELECT   StuffID ,
                                        SUM(SaleMain) SaleMain ,
                                        SUM(SaleSub) SaleSub ,
                                        SUM(SalePrice) SalePrice ,
                                        SUM(SaleDiscount) SaleDiscount ,
                                        SUM(A.SaleCost) SaleCost ,
                                        SUM(ReturnMain) ReturnMain ,
                                        SUM(ReturnSub) ReturnSub ,
                                        SUM(ReturnPrice) ReturnPrice ,
                                        SUM(ReturnDiscount) ReturnDiscount ,
                                        SUM(SaleNet) SaleNet ,
                                        SUM(SaleTax) SaleTax ,
                                        SUM(SaleDuty) SaleDuty ,
                                        SUM(ReturnNet) ReturnNet ,
                                        SUM(ReturnTax) ReturnTax ,
                                        SUM(ReturnDuty) ReturnDuty ,
                                        SUM(A.ReturnCost) ReturnCost
                               FROM     (   SELECT StuffID ,
                                                   ii.MainQuantity SaleMain ,
                                                   ii.SubQuantity SaleSub ,
                                                   ii.Price SalePrice ,
                                                   ii.Discount SaleDiscount ,
                                                   ii.NetPrice SaleNet ,
                                                   ii.Tax SaleTax ,
                                                   ii.Duty SaleDuty ,
                                                   ii.Cost SaleCost ,
                                                   0 ReturnMain ,
                                                   0 ReturnSub ,
                                                   0 ReturnPrice ,
                                                   0 ReturnDiscount ,
                                                   0 ReturnNet ,
                                                   0 ReturnTax ,
                                                   0 ReturnDuty ,
                                                   0 ReturnCost
                                            FROM   POS.PosInvoice i
                                                   JOIN POS.PosInvoiceItem ii ON ii.PosInvoiceID = i.PosInvoiceID
                                                   JOIN POS.StationShift ss ON ss.StationShiftID = i.StateShiftID
                                                   JOIN POS.Station s ON s.StationID = ss.StationID
                                                   JOIN CFG.Party p ON p.PartyID = i.CustomerID
                                                   JOIN #vwStationShiftAccess AS nss ON nss.StationShiftID = i.StateShiftID
                                            WHERE  i.Date
                                                   BETWEEN @FromDate AND @EndDate
                                                   AND Status = 1
                                                   AND i.IsReturnInvoice = 0
                                                   AND (   @Customer IS NULL
                                                           OR i.CustomerID IN (   SELECT value
                                                                                  FROM   CFG.R_FnCommaStr2Table(
                                                                                             @Customer) ))
                                                   AND (   @SelectedCustomerGroup IS NULL
                                                           OR p.CustomerGroupID IN (   SELECT value
                                                                                       FROM   CFG.R_FnCommaStr2Table(
                                                                                                  @SelectedCustomerGroup) ))
                                                   AND (   @Branch IS NULL
                                                           OR s.BranchID IN (   SELECT value
                                                                                FROM   CFG.R_FnCommaStr2Table(
                                                                                           @Branch) ))
                                                   AND (   @SelectedShift IS NULL
                                                           OR i.StateShiftID IN (   SELECT value
                                                                                    FROM   CFG.R_FnCommaStr2Table(
                                                                                               @SelectedShift) ))
                                                   AND (   @SelectedSaleModels IS NULL
                                                           OR ii.SaleModelID IN (   SELECT value
                                                                                    FROM   CFG.R_FnCommaStr2Table(
                                                                                               @SelectedSaleModels) ))
                                                   AND (   @SelectedSaleGroup IS NULL
                                                           OR ii.StuffID IN (   SELECT sd.StuffID
                                                                                FROM   CFG.[Group] g
                                                                                       INNER JOIN STF.StuffDetail sd ON sd.SalesGroupID = g.GroupID
                                                                                WHERE  g.GroupType = 2
                                                                                       AND g.GroupID IN (   SELECT value
                                                                                                            FROM   CFG.R_FnCommaStr2Table(
                                                                                                                       @SelectedSaleGroup) )))
                                                   AND (   @SelectedIds IS NULL
                                                           OR i.PosInvoiceID IN (   SELECT VALUE
                                                                                    FROM   #Invoice ))
                                            UNION ALL
                                            SELECT StuffID ,
                                                   0 SaleMain ,
                                                   0 SaleSub ,
                                                   0 SalePrice ,
                                                   0 SaleDiscount ,
                                                   0 Net ,
                                                   0 SaleTax ,
                                                   0 SaleDuty ,
                                                   0 SaleCost ,
                                                   -MainQuantity ReturnMain ,
                                                   -SubQuantity ReturnSub ,
                                                   -Price ReturnPrice ,
                                                   Discount ReturnDiscount ,
                                                   -ii.NetPrice ReturnNet ,
                                                   -ii.Tax ReturnTax ,
                                                   -ii.Duty ReturnDuty ,
                                                   ii.Cost ReturnCost
                                            FROM   POS.PosInvoice i
                                                   JOIN POS.PosInvoiceItem ii ON ii.PosInvoiceID = i.PosInvoiceID
                                                   JOIN POS.StationShift ss ON ss.StationShiftID = i.StateShiftID
                                                   JOIN POS.Station s ON s.StationID = ss.StationID
                                                   JOIN CFG.Party p ON p.PartyID = i.CustomerID
                                                   JOIN #vwStationShiftAccess AS nss ON nss.StationShiftID = i.StateShiftID
WHERE  i.Date
    BETWEEN @FromDate AND @EndDate
    AND i.Status = 1
    AND i.IsReturnInvoice = 1
    AND (   @Customer IS NULL
            OR i.CustomerID IN (   SELECT value
                                    FROM   CFG.R_FnCommaStr2Table(
                                                @Customer) ))
    AND (   @SelectedCustomerGroup IS NULL
            OR p.CustomerGroupID IN (   SELECT value
                                        FROM   CFG.R_FnCommaStr2Table(
                                                    @SelectedCustomerGroup) ))
    AND (   @Branch IS NULL
            OR s.BranchID IN (   SELECT value
                                FROM   CFG.R_FnCommaStr2Table(
                                            @Branch) ))
    AND (   @SelectedSaleModels IS NULL
            OR ii.SaleModelID IN (   SELECT value
                                    FROM   CFG.R_FnCommaStr2Table(
                                                @SelectedSaleModels) ))
    AND (   @SelectedSaleGroup IS NULL
            OR ii.StuffID IN (   SELECT sd.StuffID
                                FROM   CFG.[Group] g
                                        INNER JOIN STF.StuffDetail sd ON sd.SalesGroupID = g.GroupID
                                WHERE  g.GroupType = 2
                                        AND g.GroupID IN (   SELECT value
                                                            FROM   CFG.R_FnCommaStr2Table(
                                                                        @SelectedSaleGroup) )))
    AND (   @SelectedShift IS NULL
            OR i.StateShiftID IN (   SELECT value
                                    FROM   CFG.R_FnCommaStr2Table(
                                                @SelectedShift) ))
    AND (   @SelectedIds IS NULL
            OR i.PosInvoiceID IN (   SELECT VALUE
                                    FROM   #ReturnedInvoice ))) A
                               GROUP BY StuffID ) temp ON temp.StuffID = stf.StuffID ) result;
