---------------------------------------------------------------------------------------------------------
create    proc ATN.spGetPersonnelToShiftAssignment
(
@Date Date
)
as

	DECLARE @CultureNo int;

	select @CultureNo = CultureNo
	from cfg.CultureInfo
	where Culture = cfg.GetuserCulture();

		SELECT p.PersonelID,
			   p.Code,
			   case when @CultureNo = 1 then (pa.Title + ' ' + ISNULL(pa.LastName, '')) 
					else  (pa.Title2 + ' ' + ISNULL(pa.LastName2, ''))  
			   end AS FullName
		FROM HRM.Personel p
			INNER JOIN CFG.Party pa
				ON p.PartyID = pa.PartyID
			LEFT JOIN
			(
				SELECT *
				FROM
				(
					SELECT *,
						   ROW_NUMBER() OVER (PARTITION BY cps.PersonelID ORDER BY cps.ChangeDate DESC) AS Rno
					FROM hrm.ChangePersonelStatus cps
					WHERE cps.ChangeDate <= @Date
				) T1
				WHERE Rno = 1
			) T
				ON T.PersonelID = p.PersonelID
				   AND t.Rno = 1
			left join
			(
			select i.PersonelID
			from ATN.PersonnelShiftAssignmentitem i 
			where i.Date >= @Date
			group by i.PersonelID
			) psa on psa.PersonelID = p.PersonelID
		WHERE T.[Status] <> 3
		and psa.PersonelID is null;
