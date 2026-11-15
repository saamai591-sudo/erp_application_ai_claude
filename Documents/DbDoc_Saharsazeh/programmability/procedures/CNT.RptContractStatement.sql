
-----------------------------------------------------------
CREATE    PROC [CNT].RptContractStatement
(
	@Contracts varchar(max) = null
)
--WITH ENCRYPTION
AS
	 DECLARE       @UserID            INT,
				   @DateType          TINYINT,
				   @Culture           VARCHAR(10),
				   @DateFormat        VARCHAR(10),
				   @CultureNo TINYINT

	SET @UserID = CFG.GetuserID()
	SET @Culture = cfg.GetuserCulture()

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	SELECT @DateType = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @UserID
	
	IF @DateType IS NULL
	    SET @DateType = CASE @Culture
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	SELECT @DateFormat = us.SettingValue
	FROM   cfg.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @UserID
	
	IF @DateFormat IS NULL
	    SET @DATEFORMAT = 'YY/MM/DD' 	

	DECLARE @Columns                 NVARCHAR(MAX),
			@ColumnsInSelectList     NVARCHAR(MAX),
			@ColumnsInPayedSelectList     NVARCHAR(MAX),
			@query                   NVARCHAR(MAX),
			@param                   NVARCHAR(MAX),
			@CodeAndTitleColumn      NVARCHAR(MAX),
			@LeftJoin                NVARCHAR(MAX)
	
	SELECT @Columns = STUFF(
			   (
				   SELECT DISTINCT ',' + QUOTENAME(AdditionDeductionTypeID)
				   FROM   CNT.AdditionDeductionType
						  FOR XML PATH(''),
						  TYPE
			   ).value('.', 'NVARCHAR(MAX)'),
			   1,
			   1,
			   ''
		   )
								   
	IF (@Columns IS NULL)
		SET @Columns = '[-1]'

	SELECT @ColumnsInSelectList = STUFF(
			   (
				   SELECT   DISTINCT ',ISNULL(p1.' + 
							QUOTENAME(AdditionDeductionTypeID) + 
							',0) AS T' + CAST(AdditionDeductionTypeID AS VARCHAR(10))
				   FROM   CNT.AdditionDeductionType
						  FOR XML PATH(''),
						  TYPE
			   ).value('.', 'NVARCHAR(MAX)'),
			   1,
			   0,
			   ''
		   )
								   
	IF (@ColumnsInSelectList IS NULL)
		SET @ColumnsInSelectList = ''

	SELECT @ColumnsInPayedSelectList = STUFF(
			   (
				   SELECT   DISTINCT ',ISNULL(p2.' + 
							QUOTENAME(AdditionDeductionTypeID) + 
							',0) AS PayedT' + CAST(AdditionDeductionTypeID AS VARCHAR(10))
				   FROM   CNT.AdditionDeductionType
						  FOR XML PATH(''),
						  TYPE
			   ).value('.', 'NVARCHAR(MAX)'),
			   1,
			   0,
			   ''
		   )
								   
	IF (@ColumnsInPayedSelectList IS NULL)
		SET @ColumnsInPayedSelectList = ''

	SELECT * 
	INTO #vwBranchAccess 
	FROM cfg.vwBranchAccess 

CREATE TABLE #ContractCurrency (
    ContractID INT,
    CurrencyID INT
);


WITH SplitComma AS (
    SELECT value AS KeyValuePair
    FROM STRING_SPLIT(@Contracts, ',') 
),
SplitHash AS (
    SELECT
        LEFT(KeyValuePair, CHARINDEX('#', KeyValuePair) - 1) AS ContractID,
        RIGHT(KeyValuePair, LEN(KeyValuePair) - CHARINDEX('#', KeyValuePair)) AS CurrencyID 
    FROM SplitComma
)

INSERT INTO #ContractCurrency (ContractID, CurrencyID)
SELECT CAST(ContractID AS INT), CAST(CurrencyID AS INT)
FROM SplitHash;

set @query = N'select		cs.Number,
							cs.ContractID,
							cs.ContractStatementID,
							case when @CultureNo  = 1 then cst.Title else  cst.Title2 end as  ContractStatementType,
							cs.FromDate,
							cs.EndDate,
							c.Number ContractNumber,
							dl.code PartyDlCode,
							case when @CultureNo  = 1 then dl.Title else  dl.Title2 end as  PartyName,
							cs3.Date ConfirmDate,
							cfg.GetCLRSaturnDate(cs.FromDate,@DateFormat,0,@DateType) Date_FromDate,
							cfg.GetCLRSaturnDate(cs.EndDate,@DateFormat,0,@DateType)  Date_EndDate,
							cfg.GetCLRSaturnDate(cs3.Date,@DateFormat,0,@DateType)  Date_ConfirmDate,
							csr.Amount,
							csr.Net,
							csr.PayedConfirmStatement,
							Vat.Vat,							
							PayedVat
						   '+ @ColumnsInSelectList + 
						      @ColumnsInPayedSelectList + '
						from cnt.ContractStatement cs
						join cnt.ContractStatementType cst on cs.ContractStatementTypeID = cst.ContractStatementTypeID
						JOIN CNT.Contract AS c ON c.ContractID = cs.ContractID
						JOIN  #vwBranchAccess Branch on Branch.BranchID = C.BranchID
						join cfg.party on party.partyid = c.partyid
						join acc.dl  on dl.dlid = party.dlid
						left join cnt.ConfirmStatement cs3 
							 on cs.ContractStatementID = cs3.ContractStatementID
						left join 
						(select ConfirmStatementid,SUM(Amount) Amount,SUM(Done) PayedConfirmStatement,SUM(Net) Net
						from cnt.vwConfirmStatementRemain
						group by ConfirmStatementid
						)csr on csr.ConfirmStatementid = cs3.ConfirmStatementid
						left join 
						(select ContractStatementID,SUM(Vat) Vat,SUM(Done) PayedVat
						from CNT.vwContractStatementRemain
						group by ContractStatementID
						)vat on vat.ContractStatementID = cs.ContractStatementID
						left join
						(
							select AdditionDeductionTypeID,ConfirmStatementID,SUM(Net) Value
							from CNT.vwConfirmStatementItemRemain 
							group by AdditionDeductionTypeID,ConfirmStatementID			
						)x
						pivot
						(
						max(value)
						for AdditionDeductionTypeID in ('+@Columns+')			
						)P1 on p1.ConfirmStatementID = cs3.ConfirmStatementID
						left join
						(
							select AdditionDeductionTypeID,ConfirmStatementID,SUM(Done) Value
							from CNT.vwConfirmStatementItemRemain 
							group by AdditionDeductionTypeID,ConfirmStatementID			
						)x
						pivot
						(
						max(value)
						for AdditionDeductionTypeID in ('+@Columns+')			
						)P2 on p2.ConfirmStatementID = cs3.ConfirmStatementID
					where  (@pContracts is null or (cs.ContractID in
					(SELECT ContractID FROM   #ContractCurrency)) and cs.CurrencyID in (SELECT CurrencyID FROM   #ContractCurrency))	 
					and c.CompanyRoll = 1
							   '
SET @param = N' @pContracts varchar(max),
				@DateType   TINYINT,
				@DateFormat VARCHAR(10),
				@CultureNo char(1) '
				   
EXECUTE sp_executeSQL  
			@query,
			@param,
			@pContracts = @Contracts,
			@CultureNo  = @CultureNo ,
			@DateType = @DateType,
			@DateFormat = @DateFormat;
