
Create    PROC [STM].SprptPettyCash
@ID NVARCHAR(MAX)
--WITH ENCRYPTION
AS

CREATE TABLE #Ids
(
	id INT
)

INSERT INTO #Ids
SELECT [value]
FROM   cfg.R_FnCommaStr2Table(@ID)
----------------

DECLARE @Columns     AS NVARCHAR(MAX),
        @Query       AS NVARCHAR(MAX),
        @IsBranchInstalled     BIT,
        @Param                 NVARCHAR(MAX),
        @Culture NVARCHAR(20),
        @UserID INT,
		@cultureNo INT;

SELECT @Columns = STUFF(
           (
               SELECT DISTINCT ',' + QUOTENAME(AccountLevelID)
               FROM   ACC.AccountLevel
                      FOR XML PATH(''),
                      TYPE
           ).value('.', 'NVARCHAR(MAX)'),
           1,
           1,
           ''
       )
						
IF (@Columns IS NULL)
    SET @Columns = '[-1]'
	SELECT @IsBranchInstalled = li.LicenceValue
FROM   cfg.LicenceInfo AS li 

	SET @Culture = CFG.GetuserCulture();
	SET @UserID = CFG.GetuserID();

	SELECT @CultureNo = CultureNo
	FROM CFG.CultureInfo 
	WHERE Culture = @Culture


SET @Query = N'select b.PettyCashCostID,
           case when @CultureNo = 1 then   f.Title + '' '' + d.Title Else f.Title2 + '' '' + d.Title2 End as Title,
                      pi1.InvoiceNumber,
                       CASE 
            WHEN @IsBranchInstalled = 1 THEN  case when @CultureNo = 1 then  br.Title Else br.Title2 End
            ELSE ''''
       END BranchTitle,
					  a.PettyCashID,
					  CAST(CASE WHEN pa.[Type] = 1 or pa.[Type] = 2 THEN case when @CultureNo = 1 then   pa.Title
					  Else pa.Title2 End
						        WHEN pa.[Type] = 0 THEN case when @CultureNo = 1 then  pa.Title+'' ''+pa.LastName
						        else pa.Title2+'' ''+pa.LastName2 End
				      END AS NVARCHAR(512)) AS PettyCashier,
					  CFG.GetSaturnDate(b.Date,0) [HederDate],
                      CFG.GetSaturnDate(c.Date,0) [ItemDate], 
                     case when @CultureNo = 1 then  p2.Title+'' '' +isnull(p2.LastName,'''')
                     else p2.Title2+'' '' +isnull(p2.LastName2,'''') End
                       DeliveredTo,                
                      c.Amount,
                      case when @CultureNo = 1 then  c.Description else c.Description2 end Description,
                      case when @CultureNo = 1 then  b.Description else b.Description2 end As HeaderDescription,
                      c.RowIndex,
                      ' + @Columns + ',
                      case when @CultureNo = 1 then  pp.SlTitle else pp.Sltitle2 End SlTitle,
                      pp.Slcode Slcode,
                      u.Name as CreatorName,
					  b.number,c.TraceNumber,
					  Cmp.Title CompanyTitle1,
					  Cmp.Title2 CompanyTitle2

From FIN.PettyCashCost b
join cfg.Branch br on b.branchid=br.BranchID
join cfg.Company cmp on br.CompanyID = cmp.CompanyID
join FIN.PettyCash a on a.PettyCashID = b.PettyCashID
JOIN FIN.Fund AS f ON f.FundId = a.FundID
join FIN.PettyCashCostItem c on c.PettyCashCostID = b.PettyCashCostID 
join fin.paymenttype pt on pt.paymenttypeid = c.paymenttypeid
join CFG.Party pa on a.PartyID = pa.PartyID
JOIN ACC.DL AS d ON d.DLID = pa.DlID
join cfg.party p2 on c.partyid=p2.partyid
join Cfg.[user] u on u.UserId = b.Creator
left join Acc.vwAccounts pp on pp.slid = pt.SlID
left join Vnd.PurchaseInvoice pi1 on c.PurchaseInvoiceID=pi1.PurchaseInvoiceID
left join 
(
	select PettyCashCostItemID,AccountLevelID,Case When DLID IS NOT NULL
           THEN cast ((select title from Acc.DL dl where dl.DLID=pt.DLID) as nvarchar(max)) else Value end Value
	from FIN.PettyCashCostItemAccountLevel pt
) x
pivot 
(
	 max(Value)
for AccountLevelID IN  ( ' + @Columns + 
    ')
) p on p.PettyCashCostItemID=c.PettyCashCostItemID

where  b.PettyCashCostID in (select id from #Ids)'


SET @Param = N'@IsBranchInstalled bit,@CultureNo Int'
EXECUTE sp_executeSQL 
        @Query,
     @Param,
     @IsBranchInstalled = @IsBranchInstalled,
     @cultureNo = @cultureNo
