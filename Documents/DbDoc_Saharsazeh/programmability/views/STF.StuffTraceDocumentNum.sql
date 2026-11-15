
CREATE    VIEW stf.StuffTraceDocumentNum
as
SELECT Row_number() OVER (order by st.StuffTraceID,tdnt.DocumentNumTypeID ) AS ID,
       st.StuffTraceID,
       tdnt.TraceDocumentNumTypeID,
       tdnt.DocumentNumTypeID,
       CAST(1 AS BIT) AS IsMandetory
FROM   stf.StuffTrace                 AS st
       JOIN stf.Trace                 AS t
            ON  t.TraceID = st.TraceID
       JOIN stf.TraceDocumentNumType  AS tdnt
            ON  tdnt.TraceID = t.TraceID
