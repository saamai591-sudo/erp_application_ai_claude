-----------------------------------------------------------------------------------


CREATE   PROc [STM].[Reception] 


@ID nvarchar(max)
--WITH ENCRYPTION 
AS

create table ##Ids
(id int)

insert into ##Ids
SELECT [value] FROM   cfg.R_FnCommaStr2Table(@ID)

Declare @Columns AS NVARCHAR(MAX),
@Query  AS NVARCHAR(MAX),
@CustomeFields  AS NVARCHAR(MAX)

select @Columns = STUFF((SELECT distinct ',' + QUOTENAME(TraceID) 
									FROM STF.Trace
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')
 select @CustomeFields =  STUFF((SELECT distinct ',' + QUOTENAME(Fieldname) 
									FROM cfg.EntityCustomeField
									WHERE EntityName = 'Reception'
									FOR XML PATH(''), TYPE
								   ).value('.', 'NVARCHAR(MAX)'),1,1,'')
if(@CustomeFields is null)								   
set @CustomeFields = '[NoCustomeField]' 

if(@Columns is null)								   
set @Columns = '[-1]'

set @Query = N'

SELECT 
case b.Type   when 1 then b.Title
when 2 then b.Title
when 0 then b.Title +''  ''+ b.LastName
End CustomerName,
Branch.phone BranchPhone,
Branch.Fax BranchFax,
Branch.title BranchTitle,
branch.ADDRESS BranchAddress
,phone.Phone phone,
o.ReceptionItemID,
inv.Number InvoiceNumber,
st.Title StuffTitle,
st.Code StuffCode,o.Quantity
,CFG.GetSaturnDate(inv.Date,0) InvoiceDate,
CFG.GetSaturnDate(a.Date,0) ReceptionDate,
a.Number ReceptionNumber,
o.Description ReceptionDescription,
a.ReceptionID,ad.ADDRESS ,
rt.Title ReceptionType,
us.Name,
' + @Columns + '
,
(SELECT  Top 1 Mobile.Phone 
FROM CFG.Phone Mobile
join CFG.AddressType t on Mobile.AddressTypeID = t.AddressTypeID
 WHERE t.Nature=2
 And Mobile.partyID=a.CustomerID
) Mobile,
CustomEntities.*,
Dl.Code DlCode,
ph.phone phone1,
ph2.phone phone2,
ph3.phone phone3

---------------
FROM CTM.Reception a
JOIN ctm.ReceptionItem o ON o.ReceptionID=a.ReceptionID

JOIN STF.VWStuff st ON st.StuffID=o.StuffID
JOIN CFG.Party b ON b.PartyID=a.CustomerID
left join Acc.dl Dl on DL.Dlid=b.dlid
LEFT JOIN SLE.InvoiceItem ini ON ini.InvoiceItemID=o.InvoiceItemID
Left JOIN SLE.Invoice inv ON inv.InvoiceID=ini.InvoiceID
JOIN CFG.Branch Branch ON Branch.BranchID=a.BranchID
LEFT JOIN CFG.Party pa ON pa.PartyID=inv.CustomerID
LEFT JOIN (SELECT  phone,partyid,IsMain 
           FROM CFG.Phone Phone
		   join CFG.AddressType t on Phone.AddressTypeID = t.AddressTypeID
		   WHERE t.Nature=1 ) phone ON phone.PartyID = a.CustomerID AND phone.IsMain=1
LEFT JOIN CFG.Address ad ON ad.PartyID=a.CustomerID AND ad.IsMain=1
JOIN CFG.[user] US ON US.UserID=a.Creator
JOIN CTM.ReceptionType rt ON rt.ReceptionTypeID=a.ReceptionTypeID
left JOIN (SELECT  *, ROW_NUMBER() OVER(
	                      PARTITION BY partyid
	                       ORDER BY phoneid Asc
	                  )  AS Rno FROM cfg.phone) ph on ph.PartyID=a.CustomerID and rno=1
left JOIN (SELECT  *, ROW_NUMBER() OVER(
	                      PARTITION BY partyid
	                       ORDER BY phoneid Asc
	                  )  AS Rno2 FROM cfg.phone) ph2 on ph2.PartyID=a.CustomerID and rno2=2
					  left JOIN (SELECT  *, ROW_NUMBER() OVER(
	                      PARTITION BY partyid
	                       ORDER BY phoneid Asc
	                  )  AS Rno3 FROM cfg.phone) ph3 on ph3.PartyID=a.CustomerID and rno3=3
left join 
(select ReceptionItemID,TraceID,Case When tr.DLID IS NOT NULL 
THEN cast ((select title from acc.DL dl where dl.DLID=tr.DlID) as nvarchar(max)) else Value end Value
  from CTM.ReceptionItemTrace tr
  ) x
pivot 
(
	 max(Value)
	for TraceID in ( ' + @Columns + ')
)  piv on piv.ReceptionItemID = o.ReceptionItemID
left join 
(
SELECT * FROM
(SELECT ecf.EntityID,ecfd.Fieldname,
case when ecfd.fieldtype = 2 then cfg.getsaturndate(ecf.[Value],0) else  ecf.[Value] end as Value
 FROM cfg.EntityCustomeField ecfd
left JOIN cfg.EntityCustomeFieldData ecf
 ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
WHERE ecfd.EntityName = ''Reception''
)x
pivot 
(
	 max(Value)
	for Fieldname IN ('+@CustomeFields+')
)  piv	
)CustomEntities on CustomEntities.EntityID = a.ReceptionID



where a.ReceptionID in (select id from ##Ids)'

EXECUTE sp_executeSQL     
            @Query

	
IF EXISTS (SELECT * FROM tempdb.sys.tables WHERE name = '##Ids')DROP TABLE ##Ids;
