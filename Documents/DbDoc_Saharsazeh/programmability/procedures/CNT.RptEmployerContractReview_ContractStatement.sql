
CREATE   PROC [CNT].RptEmployerContractReview_ContractStatement
(
	@Contracts varchar(max) = null
)
--WITH ENCRYPTION
as
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

	set @query = N'select	cs.Number,
							cs.ContractID,
							cs.ContractStatementID,
							cs.FromDate,
							cs.EndDate,
							cst.Title AS ContractStatementType,
							dl.code PartyDlCode,
							dl.title PartyName,
							cs3.Date ConfirmDate,
							cfg.GetCLRSaturnDate(cs.FromDate,''YY/MM/DD'',0,0) Date_FromDate,
							cfg.GetCLRSaturnDate(cs.EndDate,''YY/MM/DD'',0,0)  Date_EndDate,
							cfg.GetCLRSaturnDate(cs3.Date,''YY/MM/DD'',0,0)  Date_ConfirmDate,
							csr.Amount,
							csr.Net,
							csr.RecievedConfirmStatement,
							Vat.Vat,							
							RecievedVat
						   '+ @ColumnsInSelectList + 
						      @ColumnsInPayedSelectList + '
						from cnt.ContractStatement cs
						JOIN CNT.Contract AS c ON c.ContractID = cs.ContractID
						JOIN CNT.ContractStatementType AS cst ON cst.ContractStatementTypeID=cs.ContractStatementTypeID
						JOIN  #vwBranchAccess Branch on Branch.BranchID = C.BranchID
						join cfg.party on party.partyid = c.partyid
						join acc.dl  on dl.dlid = party.dlid
						left join cnt.ConfirmStatement cs3 
							 on cs.ContractStatementID = cs3.ContractStatementID
						left join 
						(select ConfirmStatementid,SUM(Amount) Amount,SUM(Done) RecievedConfirmStatement,SUM(Net) Net
						from cnt.vwConfirmStatementRemain
						group by ConfirmStatementid
						)csr on csr.ConfirmStatementid = cs3.ConfirmStatementid
						left join 
						(select ContractStatementID,SUM(Vat) Vat,SUM(Done) RecievedVat
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
					where  (@pContracts is null or cs.ContractID in
					(SELECT VALUE FROM   CFG.R_FnCommaStr2Table(@pContracts)))	
					 and c.CompanyRoll = 2 '

	SET @param = N'@pContracts varchar(max) '
																					 
	EXECUTE sp_executeSQL  
				@query,
				@param,
				@pContracts = @Contracts

