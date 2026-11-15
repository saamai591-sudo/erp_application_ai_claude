CREATE   PROC ACC.ConvertDl
(
@SourceDBName varchar(150),
@DestinationDBName varchar(150)
)
as



declare @Query nvarchar(max)

set @Query= N'
INSERT INTO '+@DestinationDBName+'.[ACC].[DL]
           ([DlTypeID]
           ,[Code]
           ,[ParentID]
           ,[Title]
           ,[Title2]
           ,[IsActive]
           ,[Version]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate])
select 
a.[DlTypeID]
           ,a.[Code]
           ,null
           ,a.[Title]
           ,a.[Title2]
           ,a.[IsActive]
           ,0
           ,-1
           ,GETDATE()
           ,-1
           ,GETDATE()

 from '+@SourceDBName+'.acc.dl a
left join '+@DestinationDBName+'.acc.dl b on a.Code = b.Code
where b.DLID is null'

exec(@Query)

set @Query= N'
INSERT INTO '+@DestinationDBName+'.[CFG].[BankBranch]
           ([BankID]
           ,[Code]
           ,[Title]
           ,[Title2]
           ,[LocationID]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version])
select 
			a.[BankID]
           ,a.[Code]
           ,a.[Title]
           ,a.[Title2]
           ,a.[LocationID]
           ,-1
           ,getdate()
           ,-1
           ,getdate()
           ,a.[Version]
from '+@SourceDBName+'.[CFG].[BankBranch] a
left join  '+@DestinationDBName+'.[CFG].[BankBranch] b
	on a.bankid = b.bankid 
	and a.code = b.code
where b.BankBranchid is null'

exec(@Query)

set @Query= N'
INSERT INTO '+@DestinationDBName+'.[CFG].[BankAccount]
           ([BankBranchID]
           ,[AccountNo]
           ,[BankAccountTypeID]
           ,[DlID]
           ,[CurrencyID]
           ,[CurrencyRate]
           ,[FirstAmount]
           ,[IsActive]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version]
           ,[FirstDate]
           ,[BankAccountOwner]
           ,[SLID])
select 
			d.[BankBranchID]
           ,a.[AccountNo]
           ,a.[BankAccountTypeID]
           ,f.[DlID]
           ,a.[CurrencyID]
           ,a.[CurrencyRate]
           ,a.[FirstAmount]
           ,a.[IsActive]
           ,-1
           ,getdate()
           ,-1
           ,getdate()
           ,a.[Version]
           ,a.[FirstDate]
           ,a.[BankAccountOwner]
           ,h.[SLID]
from '+@SourceDBName+'.cfg.[BankAccount] a
left join '+@DestinationDBName+'.cfg.[BankAccount] b
	on a.[AccountNo] = b.[AccountNo]
join '+@SourceDBName+'.[CFG].[BankBranch] c
	on a.[BankBranchID] = c.[BankBranchID]
join '+@DestinationDBName+'.[CFG].[BankBranch] d
	on d.bankid = c.bankid 
	and d.code = c.code
join '+@SourceDBName+'.acc.dl e
	on e.dlid = a.dlid
join '+@DestinationDBName+'.acc.dl f
	on f.code = e.code
join '+@SourceDBName+'.acc.vwaccounts g
	on g.slid = a.slid
join '+@DestinationDBName+'.acc.vwaccounts h
	on h.slcode = g.slcode
where b.[BankBranchID] is null'

exec(@Query)


set @Query= N'
INSERT INTO '+@DestinationDBName+'.[CFG].[Cash]
           ([Title]
           ,[Title2]
           ,[IsActive]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[Version]
           ,[DlID])
select
			a.[Title]
           ,a.[Title2]
           ,a.[IsActive]
           ,-1
           ,getdate()
           ,-1
           ,getdate()
           ,a.[Version]
           ,f.[DlID]
from '+@SourceDBName+'.[CFG].[Cash] a
join '+@SourceDBName+'.acc.dl e
	on e.dlid = a.dlid
join '+@DestinationDBName+'.acc.dl f
	on f.code = e.code
left join '+@DestinationDBName+'.[CFG].[Cash] b
	on f.dlid = b.dlid
where b.cashid is null'

exec(@Query)

set @Query= N'
INSERT INTO '+@DestinationDBName+'.[CFG].[Party]
           ([Type]
           ,[Title]
           ,[Title2]
           ,[IdentificationCode]
           ,[EconomicCode]
           ,[IsActive]
           ,[IsInBlackList]
           ,[IsCustomer]
           ,[CreditControl]
           ,[CustomerCredit]
           ,[IsDetterent]
           ,[IntroductionName]
           ,[IsVendor]
           ,[Version]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate]
           ,[DlID]
           ,[CustomerGroupID]
           ,[IntroductionID]
           ,[VendorGroupID]
           ,[ExemptFromTax]
           ,[CustomerCode]
           ,[NationalID]
           ,[LastName]
           ,[LastName2]
           ,[Email]
           ,[IsReceptionist]
           ,[TradeName]
           ,[TradeName2]
           ,[IsShoppingCardExporter]
           ,[RegisterCode]
           ,[Nationality]
           ,[FidaCode]
           ,[FidaIdCode])
select
			a.[Type]
           ,a.[Title]
           ,a.[Title2]
           ,a.[IdentificationCode]
           ,a.[EconomicCode]
           ,a.[IsActive]
           ,a.[IsInBlackList]
           ,a.[IsCustomer]
           ,a.[CreditControl]
           ,a.[CustomerCredit]
           ,a.[IsDetterent]
           ,a.[IntroductionName]
           ,a.[IsVendor]
           ,0
           ,-1
           ,getdate()
           ,-1
           ,getdate()
           ,f.[DlID]
           ,null
           ,null
           ,null
           ,a.[ExemptFromTax]
           ,a.[CustomerCode]
           ,a.[NationalID]
           ,a.[LastName]
           ,a.[LastName2]
           ,a.[Email]
           ,a.[IsReceptionist]
           ,a.[TradeName]
           ,a.[TradeName2]
           ,a.[IsShoppingCardExporter]
           ,a.[RegisterCode]
           ,a.[Nationality]
           ,a.[FidaCode]
           ,a.[FidaIdCode]
from '+@SourceDBName+'.[CFG].[Party] a
join '+@SourceDBName+'.acc.dl e
	on e.dlid = a.dlid
join '+@DestinationDBName+'.acc.dl f
	on f.code = e.code
left join '+@DestinationDBName+'.[CFG].[Party] b
	on f.dlid = b.dlid
where b.Partyid is null'

exec(@Query)

set @Query= N'
INSERT INTO '+@DestinationDBName+'.[CFG].[CostCenter]
           ([CostCenterType]
           ,[Title]
           ,[Title2]
           ,[DlID]
           ,[Version]
           ,[IsActive]
           ,[Creator]
           ,[CreationDate]
           ,[LastEditor]
           ,[LastEditionDate])
select 
			a.[CostCenterType]
           ,a.[Title]
           ,a.[Title2]
           ,f.[DlID]
           ,0
           ,a.[IsActive]
           ,-1
           ,getdate()
           ,-1
           ,getdate()
from '+@SourceDBName+'.[CFG].[CostCenter] a
join '+@SourceDBName+'.acc.dl e
	on e.dlid = a.dlid
join '+@DestinationDBName+'.acc.dl f
	on f.code = e.code
left join '+@DestinationDBName+'.[CFG].[CostCenter] b
	on f.dlid = b.dlid
where b.CostCenterid is null'

exec(@Query)